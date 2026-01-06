import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware, orgMiddleware, ownerMiddleware } from '../middleware/auth.js';
import { getBillingSummary, PLAN_DEFINITIONS, sanitizePlanId, serializePlan } from '../lib/plans.js';
import { prisma } from '../lib/prisma.js';
import { parseWithSchema } from '../lib/validation.js';

const changePlanSchema = z.object({
  planId: z.string().min(1),
});

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/billing/plan', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const summary = await getBillingSummary(request.organizationId!);

    return reply.send({
      plan: {
        ...serializePlan(summary.definition),
        id: summary.plan,
        renewsAt: summary.planRenewsAt,
      },
      usage: summary.usage,
      limits: summary.limits,
      availablePlans: summary.availablePlans.map(serializePlan),
    });
  });
  
  app.get('/billing/usage', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const organizationId = request.organizationId!;
    const summary = await getBillingSummary(organizationId);

    const [instances, workflows, costHistoryRows] = await Promise.all([
      prisma.n8nInstance.findMany({
        where: { organizationId },
        include: {
          _count: { select: { workflows: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workflow.findMany({
        where: { organizationId },
        include: {
          n8nInstance: { select: { name: true } },
          _count: { select: { versions: true, executions: true } },
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.billingUsageSnapshot.findMany({
        where: { organizationId },
        orderBy: { month: 'desc' },
        take: 12,
      }),
    ]);

    const instanceUsage = instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      baseUrl: instance.baseUrl,
      environment: instance.environment,
      workflowCount: instance._count.workflows,
      createdAt: instance.createdAt.toISOString(),
      lastSeenAt: instance.lastSeenAt?.toISOString() ?? null,
    }));

    const workflowUsage = workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      instanceName: workflow.n8nInstance.name,
      versionCount: workflow._count.versions,
      executionCount: workflow._count.executions,
      lastSnapshotAt: workflow.versions[0]?.createdAt.toISOString() ?? null,
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    const estimatedMonthlyCost = summary.definition.monthlyPrice;

    return reply.send({
      plan: {
        ...serializePlan(summary.definition),
        id: summary.plan,
        renewsAt: summary.planRenewsAt,
      },
      usage: summary.usage,
      limits: summary.limits,
      instanceUsage,
      workflowUsage,
      estimatedMonthlyCost: {
        amount: estimatedMonthlyCost,
        currency: summary.definition.currency,
      },
      costHistory: costHistoryRows.map((row) => ({
        month: row.month.toISOString(),
        instances: row.instances,
        workflows: row.workflows,
        amount: row.costInCents / 100,
        currency: row.currencyCode,
      })),
    });
  });

  app.get('/billing/usage.csv', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const organizationId = request.organizationId!;

    const [instances, workflows] = await Promise.all([
      prisma.n8nInstance.findMany({
        where: { organizationId },
        include: {
          _count: { select: { workflows: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workflow.findMany({
        where: { organizationId },
        include: {
          n8nInstance: { select: { name: true } },
          _count: { select: { versions: true, executions: true } },
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const rows: string[] = [];
    rows.push([
      'Type',
      'Name',
      'Instance / Base URL',
      'Environment',
      'Workflows / Versions',
      'Executions',
      'Last Snapshot / Seen',
      'Updated At',
    ].join(','));

    for (const instance of instances) {
      rows.push([
        'Instance',
        `"${instance.name.replace(/"/g, '""')}"`,
        `"${instance.baseUrl}"`,
        instance.environment,
        String(instance._count.workflows),
        '',
        instance.lastSeenAt?.toISOString() ?? '',
        instance.updatedAt.toISOString(),
      ].join(','));
    }

    for (const workflow of workflows) {
      rows.push([
        'Workflow',
        `"${workflow.name.replace(/"/g, '""')}"`,
        `"${workflow.n8nInstance.name}"`,
        '',
        String(workflow._count.versions),
        String(workflow._count.executions),
        workflow.versions[0]?.createdAt.toISOString() ?? '',
        workflow.updatedAt.toISOString(),
      ].join(','));
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="usage.csv"');
    return reply.send(rows.join('\n'));
  });

  app.post('/billing/change-plan', {
    preHandler: [authMiddleware, orgMiddleware, ownerMiddleware],
  }, async (request, reply) => {
    const body = parseWithSchema(changePlanSchema, request.body ?? {}, reply);
    if (!body) return;

    const normalizedPlan = sanitizePlanId(body.planId ?? '');

    if (!normalizedPlan) {
      return reply.status(400).send({ error: 'Invalid plan' });
    }

    const summary = await getBillingSummary(request.organizationId!);

    if (normalizedPlan === summary.plan) {
      return reply.send({
        success: true,
        plan: {
          ...serializePlan(summary.definition),
          id: summary.plan,
          renewsAt: summary.planRenewsAt,
        },
        limits: summary.limits,
        usage: summary.usage,
      });
    }

    const extraInstanceCredits = Math.max(0, summary.limits.instances - PLAN_DEFINITIONS[summary.plan].instanceLimit);
    const extraWorkflowCredits = Math.max(0, summary.limits.workflows - PLAN_DEFINITIONS[summary.plan].workflowLimit);

    const targetDefinition = PLAN_DEFINITIONS[normalizedPlan];
    const targetLimits = {
      instances: targetDefinition.instanceLimit + extraInstanceCredits,
      workflows: targetDefinition.workflowLimit + extraWorkflowCredits,
    };

    if (summary.usage.instances > targetLimits.instances) {
      return reply.status(400).send({
        error: 'Cannot downgrade',
        message: `You currently have ${summary.usage.instances} instances but the ${targetDefinition.name} plan allows ${targetLimits.instances}. Disconnect instances before downgrading.`,
      });
    }

    if (summary.usage.workflows > targetLimits.workflows) {
      return reply.status(400).send({
        error: 'Cannot downgrade',
        message: `You currently track ${summary.usage.workflows} workflows but the ${targetDefinition.name} plan allows ${targetLimits.workflows}. Remove workflows or upgrade instead.`,
      });
    }

    const nextRenewal =
      normalizedPlan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.organization.update({
      where: { id: request.organizationId! },
      data: {
        plan: normalizedPlan,
        planStartedAt: new Date(),
        planRenewsAt: nextRenewal,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'plan.updated',
        entityType: 'organization',
        entityId: request.organizationId!,
        metadata: {
          from: summary.plan,
          to: normalizedPlan,
        },
      },
    });

    const updatedSummary = await getBillingSummary(request.organizationId!);

    return reply.send({
      success: true,
      plan: {
        ...serializePlan(updatedSummary.definition),
        id: updatedSummary.plan,
        renewsAt: updatedSummary.planRenewsAt,
      },
      limits: updatedSummary.limits,
      usage: updatedSummary.usage,
    });
  });
}
