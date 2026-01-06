import type { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { generateToken, hashToken } from '../lib/tokens.js';
import { decryptFromDb } from '../lib/encryption.js';
import { z } from 'zod';
import { parseWithSchema } from '../lib/validation.js';

const magicLinkRequestSchema = z.object({
  email: z.string().email().max(320),
});

const verifyTokenSchema = z.object({
  token: z.string().min(32).max(256),
});

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

const ssoStartSchema = z.object({
  email: z.string().email().max(320),
});

const ssoAssertSchema = z.object({
  organizationId: z.string().min(1).max(128),
  email: z.string().email().max(320),
  externalId: z.string().min(1).max(256),
  displayName: z.string().max(120).optional(),
  timestamp: z.string(),
  nonce: z.string().min(8).max(256),
  signature: z.string().min(32).max(512),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Request magic link
  app.post('/auth/magic-link', async (request, reply) => {
    const body = parseWithSchema(magicLinkRequestSchema, request.body ?? {}, reply);
    if (!body) return;
    const { email } = body;

    const normalizedEmail = email.toLowerCase();

    // Generate magic link token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.magicLinkToken.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        expiresAt,
      },
    });

    // In production, send email via Resend
    // For dev, just log the link
    const magicLink = `${process.env.WEB_URL || 'http://localhost:3000'}/auth/verify?token=${token}`;
    
    console.log(`\n🔗 Magic link for ${email}: ${magicLink}\n`);

    // Clean up expired tokens
    await prisma.magicLinkToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });

    return reply.send({ success: true, message: 'Magic link sent (check console in dev mode)' });
  });

  // Verify magic link
  app.post('/auth/verify', async (request, reply) => {
    const body = parseWithSchema(verifyTokenSchema, request.body ?? {}, reply);
    if (!body) return;
    const { token } = body;

    const tokenHash = hashToken(token);
    const tokenRecord = await prisma.magicLinkToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date() || tokenRecord.usedAt) {
      if (tokenRecord) {
        await prisma.magicLinkToken.delete({ where: { tokenHash } });
      }
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid or expired token' });
    }

    await prisma.magicLinkToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: tokenRecord.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: tokenRecord.email },
      });
    }

    // Create session
    const sessionToken = generateToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionTokenHash,
        expiresAt: sessionExpiresAt,
      },
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: sessionToken,
      expiresAt: sessionExpiresAt.toISOString(),
    });
  });

  // Start SSO login flow
  app.post('/auth/sso/start', async (request, reply) => {
    const body = parseWithSchema(ssoStartSchema, request.body ?? {}, reply);
    if (!body) return;
    const email = body.email.toLowerCase();
    const domain = email.split('@')[1];

    if (!domain) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid email domain' });
    }

    const config = await prisma.orgSsoConfig.findFirst({
      where: {
        domainHint: domain,
        enabled: true,
      },
    });

    if (!config || !config.sharedSecretEncrypted || !config.sharedSecretIv || !config.sharedSecretTag) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Aucun fournisseur SSO actif pour ce domaine',
      });
    }

    const nonce = generateToken(24);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.ssoLoginRequest.create({
      data: {
        organizationId: config.organizationId,
        email,
        nonce: hashToken(nonce),
        expiresAt,
      },
    });

    // Clean up stale requests
    await prisma.ssoLoginRequest.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const redirectUrl = config.loginUrl
      ? `${config.loginUrl}?email=${encodeURIComponent(email)}&nonce=${nonce}`
      : null;

    return reply.send({
      provider: config.provider,
      organizationId: config.organizationId,
      redirectUrl,
      nonce,
      expiresAt: expiresAt.toISOString(),
      callbackUrl: `${process.env.API_URL || process.env.WEB_URL || 'http://localhost:3000'}/auth/sso/assert`,
    });
  });

  // Assert SSO login (called by the IdP after successful authentication)
  app.post('/auth/sso/assert', async (request, reply) => {
    const body = parseWithSchema(ssoAssertSchema, request.body ?? {}, reply);
    if (!body) return;

    const config = await prisma.orgSsoConfig.findUnique({
      where: { organizationId: body.organizationId },
    });

    if (!config || !config.enabled || !config.sharedSecretEncrypted || !config.sharedSecretIv || !config.sharedSecretTag) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'SSO configuration is incomplete for this organization',
      });
    }

    const normalizedEmail = body.email.toLowerCase();
    if (config.domainHint && !normalizedEmail.endsWith(`@${config.domainHint}`)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Email domain does not match SSO configuration',
      });
    }

    const ssoRequest = await prisma.ssoLoginRequest.findFirst({
      where: {
        organizationId: body.organizationId,
        email: normalizedEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        nonce: hashToken(body.nonce),
      },
    });

    if (!ssoRequest) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'SSO request not found or expired',
      });
    }

    let signatureBuffer: Buffer;
    let expectedBuffer: Buffer;
    try {
      const sharedSecret = decryptFromDb(
        config.sharedSecretEncrypted,
        config.sharedSecretIv,
        config.sharedSecretTag
      );
      const payload = `${normalizedEmail}|${body.externalId}|${body.timestamp}|${body.nonce}`;
      const expectedSignature = createHmac('sha256', sharedSecret).update(payload).digest('hex');
      signatureBuffer = Buffer.from(body.signature, 'hex');
      expectedBuffer = Buffer.from(expectedSignature, 'hex');
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid signature format' });
    }

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid SSO signature',
      });
    }

    const timestamp = new Date(body.timestamp);
    if (!Number.isFinite(timestamp.getTime()) || Math.abs(Date.now() - timestamp.getTime()) > 5 * 60 * 1000) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Timestamp out of acceptable window',
      });
    }

    await prisma.ssoLoginRequest.update({
      where: { id: ssoRequest.id },
      data: { consumedAt: new Date() },
    });

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: body.displayName,
        },
      });
    } else if (body.displayName && user.name !== body.displayName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: body.displayName },
      });
    }

    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: body.organizationId,
        },
      },
      update: { role: config.defaultRole },
      create: {
        userId: user.id,
        organizationId: body.organizationId,
        role: config.defaultRole,
      },
    });

    const sessionToken = generateToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sessionTokenHash,
        expiresAt: sessionExpiresAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: user.id,
        action: 'auth.sso_login',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          provider: config.provider,
          externalId: body.externalId,
        },
      },
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: sessionToken,
      expiresAt: sessionExpiresAt.toISOString(),
    });
  });

  // Get current user
  app.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      include: { organization: true },
    });

    return reply.send({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })),
    });
  });

  // Logout
  app.post('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });

    return reply.send({ success: true });
  });

  // Update profile
  app.patch('/auth/profile', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = parseWithSchema(profileUpdateSchema, request.body ?? {}, reply);
    if (!body) return;
    const { name } = body;

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { name },
    });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  });
}
