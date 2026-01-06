import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, orgMiddleware, ownerMiddleware } from '../middleware/auth.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  // Create organization
  app.post('/organizations', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name is required' });
    }

    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        planStartedAt: new Date(),
        memberships: {
          create: {
            userId: request.user!.id,
            role: 'owner',
          },
        },
        settings: {
          create: {},
        },
      },
    });

    return reply.status(201).send({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
    });
  });

  // Get organization
  app.get('/organizations/:id', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: id,
        },
      },
      include: { organization: true },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    return reply.send({
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      createdAt: membership.organization.createdAt.toISOString(),
    });
  });

  // Update organization
  app.patch('/organizations/:id', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    if (membership.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Owner role required' });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { name: name?.trim() },
    });

    return reply.send({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
    });
  });

  // List members
  app.get('/organizations/:id/members', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const members = await prisma.membership.findMany({
      where: { organizationId: id },
      include: { user: true },
    });

    return reply.send({
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      })),
    });
  });

  // Invite member
  app.post('/organizations/:id/members', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email, role = 'member' } = request.body as { email: string; role?: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    if (membership.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Owner role required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: email.toLowerCase() },
      });
    }

    // Check if already a member
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: id,
        },
      },
    });

    if (existingMembership) {
      return reply.status(400).send({ error: 'Bad Request', message: 'User is already a member' });
    }

    const newMembership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: id,
        role: role === 'owner' ? 'owner' : 'member',
      },
      include: { user: true },
    });

    return reply.status(201).send({
      id: newMembership.id,
      userId: newMembership.user.id,
      email: newMembership.user.email,
      name: newMembership.user.name,
      role: newMembership.role,
    });
  });

  // Remove member
  app.delete('/organizations/:orgId/members/:memberId', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { orgId, memberId } = request.params as { orgId: string; memberId: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    if (membership.role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Owner role required' });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: { id: memberId },
    });

    if (!targetMembership || targetMembership.organizationId !== orgId) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    // Check if trying to remove last owner
    if (targetMembership.role === 'owner') {
      const ownerCount = await prisma.membership.count({
        where: { organizationId: orgId, role: 'owner' },
      });

      if (ownerCount <= 1) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Cannot remove the last owner' });
      }
    }

    await prisma.membership.delete({
      where: { id: memberId },
    });

    return reply.send({ success: true });
  });

  // Get/update org settings
  app.get('/organizations/:id/settings', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user!.id,
          organizationId: id,
        },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const settings = await prisma.orgSettings.findUnique({
      where: { organizationId: id },
    });

    return reply.send({
      hasSlackWebhook: !!settings?.slackWebhookUrlEncrypted,
    });
  });
}


