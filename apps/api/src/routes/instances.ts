import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, orgMiddleware } from '../middleware/auth.js';
import { encryptForDb, decryptFromDb } from '../lib/encryption.js';
import { createN8nClient, N8nApiError } from '../lib/n8n-client.js';
import { getBillingSummary, getInstanceLimitSnapshot, serializePlan } from '../lib/plans.js';

// Generate a secure webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function instanceRoutes(app: FastifyInstance): Promise<void> {
  // List instances
  app.get('/instances', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const organizationId = request.organizationId!;

    const [instances, billing] = await Promise.all([
      prisma.n8nInstance.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      getBillingSummary(organizationId),
    ]);

    const apiBaseUrl = process.env.API_URL || 'http://localhost:3001';
    
    return reply.send({
      plan: {
        ...serializePlan(billing.definition),
        renewsAt: billing.planRenewsAt,
      },
      usage: billing.usage,
      limits: billing.limits,
      instances: instances.map((i) => ({
        id: i.id,
        name: i.name,
        baseUrl: i.baseUrl,
        status: i.status,
        lastSeenAt: i.lastSeenAt?.toISOString() ?? null,
        webhookEnabled: !!i.webhookSecret,
        webhookUrl: i.webhookSecret 
          ? `${apiBaseUrl}/webhooks/n8n/${i.id}?secret=${i.webhookSecret}`
          : null,
        environment: i.environment,
        envColor: i.envColor,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  });

  // Get instance
  app.get('/instances/:id', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    return reply.send({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      status: instance.status,
      lastSeenAt: instance.lastSeenAt?.toISOString() ?? null,
      createdAt: instance.createdAt.toISOString(),
    });
  });

  // Create instance
  app.post('/instances', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { name, baseUrl, apiKey, environment, envColor } = request.body as {
      name: string;
      baseUrl: string;
      apiKey: string;
      environment?: string;
      envColor?: string;
    };

    if (!name || !baseUrl || !apiKey) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Name, baseUrl, and apiKey are required',
      });
    }

    // Validate URL
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid baseUrl',
      });
    }

    // Validate environment
    const validEnvs = ['production', 'staging', 'development', 'testing', 'custom'];
    const env = environment && validEnvs.includes(environment) ? environment : 'production';

    // Enforce plan limit
    const capacity = await getInstanceLimitSnapshot(request.organizationId!);
    if (capacity.count >= capacity.limit) {
      return reply.status(402).send({
        error: 'Instance limit reached',
        message: `Your ${capacity.context.definition.name} plan allows ${capacity.limit} instance${capacity.limit === 1 ? '' : 's'}. Upgrade to add more.`,
      });
    }

    // Encrypt API key
    const encrypted = encryptForDb(apiKey);

    const instance = await prisma.n8nInstance.create({
      data: {
        organizationId: request.organizationId!,
        name: name.trim(),
        baseUrl: baseUrl.replace(/\/+$/, ''), // Remove trailing slashes
        apiKeyEncrypted: encrypted.encrypted,
        apiKeyIv: encrypted.iv,
        apiKeyTag: encrypted.tag,
        environment: env,
        envColor: envColor || null,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'instance.created',
        entityType: 'n8n_instance',
        entityId: instance.id,
        metadata: { name: instance.name, baseUrl: instance.baseUrl },
      },
    });

    return reply.status(201).send({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      status: instance.status,
      createdAt: instance.createdAt.toISOString(),
    });
  });

  // Update instance
  app.patch('/instances/:id', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, baseUrl, apiKey, environment, envColor } = request.body as {
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      environment?: string;
      envColor?: string | null;
    };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const updateData: Record<string, unknown> = {};

    if (name) {
      updateData.name = name.trim();
    }

    if (baseUrl) {
      try {
        const url = new URL(baseUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
        updateData.baseUrl = baseUrl.replace(/\/+$/, '');
      } catch {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid baseUrl',
        });
      }
    }

    if (apiKey) {
      const encrypted = encryptForDb(apiKey);
      updateData.apiKeyEncrypted = encrypted.encrypted;
      updateData.apiKeyIv = encrypted.iv;
      updateData.apiKeyTag = encrypted.tag;
    }

    if (environment !== undefined) {
      const validEnvs = ['production', 'staging', 'development', 'testing', 'custom'];
      updateData.environment = validEnvs.includes(environment) ? environment : 'production';
    }

    if (envColor !== undefined) {
      updateData.envColor = envColor;
    }

    const updated = await prisma.n8nInstance.update({
      where: { id },
      data: updateData,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'instance.updated',
        entityType: 'n8n_instance',
        entityId: instance.id,
        metadata: { changes: Object.keys(updateData) },
      },
    });

    return reply.send({
      id: updated.id,
      name: updated.name,
      baseUrl: updated.baseUrl,
      status: updated.status,
      lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  });

  // Delete instance
  app.delete('/instances/:id', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    await prisma.n8nInstance.delete({
      where: { id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'instance.deleted',
        entityType: 'n8n_instance',
        entityId: instance.id,
        metadata: { name: instance.name },
      },
    });

    return reply.send({ success: true });
  });

  // Test instance connectivity
  app.post('/instances/:id/test', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    // Decrypt API key
    const apiKey = decryptFromDb(
      instance.apiKeyEncrypted,
      instance.apiKeyIv,
      instance.apiKeyTag
    );

    const client = createN8nClient({
      baseUrl: instance.baseUrl,
      apiKey,
    });

    try {
      await client.healthCheck();

      // Update status
      await prisma.n8nInstance.update({
        where: { id },
        data: {
          status: 'connected',
          lastSeenAt: new Date(),
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          organizationId: request.organizationId!,
          actorUserId: request.user!.id,
          action: 'instance.connected',
          entityType: 'n8n_instance',
          entityId: instance.id,
          metadata: {},
        },
      });

      return reply.send({ success: true, status: 'connected' });
    } catch (error) {
      const errorMessage =
        error instanceof N8nApiError
          ? error.message
          : 'Failed to connect to n8n instance';

      // Update status
      await prisma.n8nInstance.update({
        where: { id },
        data: { status: 'error' },
      });

      return reply.status(400).send({
        success: false,
        status: 'error',
        error: errorMessage,
      });
    }
  });

  // Get webhook configuration for instance
  app.get('/instances/:id/webhook', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const apiBaseUrl = process.env.API_URL || 'http://localhost:3001';
    const webhookUrl = instance.webhookSecret
      ? `${apiBaseUrl}/webhooks/n8n/${instance.id}?secret=${instance.webhookSecret}`
      : null;

    return reply.send({
      webhookEnabled: !!instance.webhookSecret,
      webhookUrl,
      // Instructions for n8n setup
      instructions: {
        step1: 'In n8n, create a new workflow with a "Webhook" trigger node',
        step2: 'Set the webhook to trigger on workflow save/update events',
        step3: 'Or use n8n\'s built-in workflow webhook feature if available',
        step4: `Configure the webhook URL to: ${apiBaseUrl}/webhooks/n8n/${instance.id}?secret=YOUR_SECRET`,
      },
    });
  });

  // Generate/regenerate webhook secret
  app.post('/instances/:id/webhook/enable', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    // Generate new webhook secret
    const webhookSecret = generateWebhookSecret();

    await prisma.n8nInstance.update({
      where: { id },
      data: { webhookSecret },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'instance.webhook.enabled',
        entityType: 'n8n_instance',
        entityId: instance.id,
        metadata: {},
      },
    });

    const apiBaseUrl = process.env.API_URL || 'http://localhost:3001';
    const webhookUrl = `${apiBaseUrl}/webhooks/n8n/${instance.id}?secret=${webhookSecret}`;

    return reply.send({
      success: true,
      webhookUrl,
      message: 'Webhook enabled. Configure this URL in your n8n instance.',
    });
  });

  // Disable webhook
  app.post('/instances/:id/webhook/disable', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    await prisma.n8nInstance.update({
      where: { id },
      data: { webhookSecret: null },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'instance.webhook.disabled',
        entityType: 'n8n_instance',
        entityId: instance.id,
        metadata: {},
      },
    });

    return reply.send({
      success: true,
      message: 'Webhook disabled.',
    });
  });
}
