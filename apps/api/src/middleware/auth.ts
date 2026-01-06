import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { hashToken } from '../lib/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string | null;
    };
    organizationId?: string;
    membership?: {
      role: string;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function orgMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const orgId = request.headers['x-organization-id'] as string;

  if (!orgId) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Missing X-Organization-Id header' });
  }

  if (!request.user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this organization' });
    }

    request.organizationId = orgId;
    request.membership = { role: membership.role };
  } catch (error) {
    console.error('Org middleware error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export async function ownerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.membership || request.membership.role !== 'owner') {
    return reply.status(403).send({ error: 'Forbidden', message: 'Owner role required' });
  }
}

