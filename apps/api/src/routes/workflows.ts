import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, orgMiddleware } from '../middleware/auth.js';
import { decryptFromDb } from '../lib/encryption.js';
import { createN8nClient, N8nApiError } from '../lib/n8n-client.js';
import { computeDeepHash } from '../lib/hash.js';
import { computeNodeSummary, getNodeChanges, getConnectionChanges } from '../lib/diff.js';
import { sendOrgNotification, buildWorkflowUrl } from '../lib/notifications.js';
import { parseN8nError, getErrorSeverity } from '../lib/error-parser.js';
import { getWorkflowLimitSnapshot } from '../lib/plans.js';
import { z } from 'zod';
import { parseWithSchema } from '../lib/validation.js';
import type { Workflow, N8nInstance } from '@prisma/client';
import {
  performTargetedRestore,
  normalizeQuarantineConfig,
  quarantineWorkflow,
  maybeTriggerAutoQuarantine,
} from '../lib/workflow-actions.js';

const stringIdSchema = z.string().min(1).max(128);
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
const workflowListQuerySchema = z.object({
  instanceId: stringIdSchema.optional(),
  search: z.string().min(1).max(100).optional(),
  environment: z.string().min(1).max(32).optional(),
});
const diffQuerySchema = z.object({
  from: stringIdSchema,
  to: stringIdSchema,
});
const workflowIdParamSchema = z.object({ id: stringIdSchema });
const workflowVersionParamSchema = z.object({
  workflowId: stringIdSchema,
  versionId: stringIdSchema,
});
const workflowParamWithWorkflowIdSchema = z.object({ workflowId: stringIdSchema });
const instanceIdParamSchema = z.object({ instanceId: stringIdSchema });
const workflowVariableParamSchema = z.object({
  id: stringIdSchema,
  variableId: stringIdSchema,
});
const workflowVersionsQuerySchema = paginationSchema;
const executionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  refresh: z.enum(['true', 'false']).optional(),
});
const errorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  errorType: z.string().min(1).max(64).optional(),
});
const snapshotBodySchema = z.object({
  label: z.string().min(1).max(120).optional(),
});
const rollbackBodySchema = z.object({
  versionId: stringIdSchema,
  confirm: z.literal(true),
});
const targetedRestoreSchema = z.object({
  versionId: stringIdSchema,
  mode: z.enum(['full', 'nodes', 'variables', 'singleNode']),
  nodeNames: z.array(z.string().min(1).max(256)).optional(),
  includeConnections: z.boolean().optional(),
});
const variableBodySchema = z.object({
  key: z.string().min(1).max(128),
  value: z.string().max(4000),
  isSecret: z.boolean().optional(),
  description: z.string().max(512).optional(),
});
const promoteBodySchema = z.object({
  targetEnvironment: z.enum(['development', 'staging', 'production']),
  targetInstanceId: stringIdSchema.optional(),
  copyVariables: z.boolean().optional(),
});
const workflowUpdateBodySchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).optional(),
  status: z.enum(['active', 'quarantined']).optional(),
  quarantineConfig: z.object({
    enabled: z.boolean().optional(),
    strategy: z
      .enum(['pause', 'rollback_full', 'rollback_nodes', 'variables_only'])
      .optional(),
    threshold: z.coerce.number().int().min(1).max(1000).optional(),
    windowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    versionId: stringIdSchema.optional(),
    nodeNames: z.array(z.string().min(1).max(256)).optional(),
    includeConnections: z.boolean().optional(),
    notify: z.boolean().optional(),
  }).optional(),
});

const quarantineActionSchema = z.object({
  reason: z.string().max(500).optional(),
  action: z.enum(['pause', 'rollback_full', 'rollback_nodes', 'variables_only']).default('pause'),
  versionId: stringIdSchema.optional(),
  nodes: z.array(z.string().min(1).max(256)).optional(),
});

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  // List workflows
  app.get('/workflows', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const query = parseWithSchema(workflowListQuerySchema, request.query, reply);
    if (!query) return;
    const { instanceId, search, environment } = query;

    const where: Record<string, unknown> = {
      organizationId: request.organizationId!,
    };

    if (instanceId) {
      where.n8nInstanceId = instanceId;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Filter by workflow environment
    if (environment) {
      where.environment = environment;
    }

    const workflows = await prisma.workflow.findMany({
      where,
      include: {
        n8nInstance: { select: { name: true } },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        _count: { select: { variables: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        n8nWorkflowId: w.n8nWorkflowId,
        instanceId: w.n8nInstanceId,
        instanceName: w.n8nInstance.name,
        environment: w.environment,
        promotedFrom: w.promotedFrom,
        promotedAt: w.promotedAt?.toISOString() ?? null,
        active: w.active,
        variableCount: w._count.variables,
        lastSnapshot: w.versions[0]?.createdAt.toISOString() ?? null,
        status: w.status,
        quarantineReason: w.quarantineReason,
        quarantineSince: w.quarantineSince?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    });
  });

  // Get workflow detail
  app.get('/workflows/:id', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: { select: { id: true, name: true } },
        variables: true,
        quarantineEvents: {
          orderBy: { createdAt: 'desc' },
          take: 8,
        },
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const versionCount = await prisma.workflowVersion.count({
      where: { workflowId: id },
    });

    return reply.send({
      id: workflow.id,
      name: workflow.name,
      n8nWorkflowId: workflow.n8nWorkflowId,
      instanceId: workflow.n8nInstance.id,
      instanceName: workflow.n8nInstance.name,
      environment: workflow.environment,
      promotedFrom: workflow.promotedFrom,
      promotedAt: workflow.promotedAt?.toISOString() ?? null,
      active: workflow.active,
      versionCount,
      status: workflow.status,
      quarantineSince: workflow.quarantineSince?.toISOString() ?? null,
      quarantineReason: workflow.quarantineReason,
      quarantineConfig: normalizeQuarantineConfig(workflow.quarantineConfig),
      quarantineTimeline: workflow.quarantineEvents.map((event) => ({
        id: event.id,
        action: event.action,
        reason: event.reason,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      })),
      variables: workflow.variables.map(v => ({
        id: v.id,
        key: v.key,
        value: v.isSecret ? '••••••••' : v.value,
        isSecret: v.isSecret,
        description: v.description,
      })),
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    });
  });

  // List workflow versions
  app.get('/workflows/:id/versions', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;
    const query = parseWithSchema(workflowVersionsQuerySchema, request.query, reply);
    if (!query) return;
    const { limit, offset } = query;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const versions = await prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        hash: true,
        label: true,
        createdAt: true,
      },
    });

    const total = await prisma.workflowVersion.count({
      where: { workflowId: id },
    });

    return reply.send({
      versions: versions.map((v, index) => ({
        id: v.id,
        hash: v.hash.substring(0, 8),
        label: v.label,
        versionNumber: total - offset - index,
        createdAt: v.createdAt.toISOString(),
      })),
      total,
    });
  });

  // Get version detail with JSON content
  app.get('/workflows/:workflowId/versions/:versionId', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowVersionParamSchema, request.params, reply);
    if (!params) return;
    const { workflowId, versionId } = params;

    const version = await prisma.workflowVersion.findFirst({
      where: {
        id: versionId,
        workflowId,
        organizationId: request.organizationId!,
      },
    });

    if (!version) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    return reply.send({
      id: version.id,
      hash: version.hash,
      label: version.label,
      jsonContent: version.jsonContent,
      createdAt: version.createdAt.toISOString(),
    });
  });

  // Compare two versions (diff)
  app.get('/workflows/:workflowId/diff', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowParamWithWorkflowIdSchema, request.params, reply);
    if (!params) return;
    const { workflowId } = params;
    const query = parseWithSchema(diffQuerySchema, request.query, reply);
    if (!query) return;
    const { from, to } = query;

    const [fromVersion, toVersion] = await Promise.all([
      prisma.workflowVersion.findFirst({
        where: {
          id: from,
          workflowId,
          organizationId: request.organizationId!,
        },
      }),
      prisma.workflowVersion.findFirst({
        where: {
          id: to,
          workflowId,
          organizationId: request.organizationId!,
        },
      }),
    ]);

    if (!fromVersion || !toVersion) {
      return reply.status(404).send({ error: 'Not Found', message: 'One or both versions not found' });
    }

    const fromJson = fromVersion.jsonContent as Record<string, unknown>;
    const toJson = toVersion.jsonContent as Record<string, unknown>;

    const summary = computeNodeSummary(fromJson, toJson);
    const nodeChanges = getNodeChanges(fromJson, toJson);
    const connectionChanges = getConnectionChanges(fromJson, toJson);

    return reply.send({
      from: {
        id: fromVersion.id,
        hash: fromVersion.hash.substring(0, 8),
        label: fromVersion.label,
        createdAt: fromVersion.createdAt.toISOString(),
      },
      to: {
        id: toVersion.id,
        hash: toVersion.hash.substring(0, 8),
        label: toVersion.label,
        createdAt: toVersion.createdAt.toISOString(),
      },
      summary,
      nodeChanges,
      connectionChanges,
      fromJson,
      toJson,
    });
  });

  // Import workflows from instance
  app.post('/instances/:instanceId/import', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(instanceIdParamSchema, request.params, reply);
    if (!params) return;
    const { instanceId } = params;

    const instance = await prisma.n8nInstance.findFirst({
      where: {
        id: instanceId,
        organizationId: request.organizationId!,
      },
    });

    if (!instance) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const workflowCapacity = await getWorkflowLimitSnapshot(request.organizationId!);
    let remainingWorkflowSlots = workflowCapacity.limit - workflowCapacity.count;
    let skippedDueToLimit = 0;

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
      const n8nWorkflows = await client.listWorkflows();

      let imported = 0;
      let updated = 0;

      for (const wf of n8nWorkflows) {
        // Fetch full workflow
        const fullWorkflow = await client.getWorkflow(wf.id);
        const hash = computeDeepHash(fullWorkflow);

        // Check if workflow exists
        const existing = await prisma.workflow.findFirst({
          where: {
            n8nInstanceId: instanceId,
            n8nWorkflowId: wf.id,
          },
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (existing) {
          // Update workflow info
          await prisma.workflow.update({
            where: { id: existing.id },
            data: {
              name: wf.name,
              active: wf.active,
            },
          });

          // Check if we need a new version
          const latestHash = existing.versions[0]?.hash;
          if (latestHash !== hash) {
            await prisma.workflowVersion.create({
              data: {
                organizationId: request.organizationId!,
                workflowId: existing.id,
                hash,
                jsonContent: fullWorkflow as object,
                label: 'Auto-imported',
              },
            });
            updated++;
          }
        } else {
          if (remainingWorkflowSlots <= 0) {
            skippedDueToLimit++;
            continue;
          }
          // Create new workflow
          const workflow = await prisma.workflow.create({
            data: {
              organizationId: request.organizationId!,
              n8nInstanceId: instanceId,
              n8nWorkflowId: wf.id,
              name: wf.name,
              active: wf.active,
            },
          });

          // Create initial version
          await prisma.workflowVersion.create({
            data: {
              organizationId: request.organizationId!,
              workflowId: workflow.id,
              hash,
              jsonContent: fullWorkflow as object,
            },
          });

          imported++;
          remainingWorkflowSlots--;
        }
      }

      // Update instance status
      await prisma.n8nInstance.update({
        where: { id: instanceId },
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
          action: 'workflow.imported',
          entityType: 'n8n_instance',
          entityId: instanceId,
          metadata: { imported, updated, total: n8nWorkflows.length },
        },
      });

      return reply.send({
        success: true,
        imported,
        updated,
        total: n8nWorkflows.length,
        limitReached: skippedDueToLimit > 0,
        skippedDueToLimit,
        remainingWorkflowSlots,
      });
    } catch (error) {
      const errorMessage =
        error instanceof N8nApiError
          ? error.message
          : 'Failed to import workflows';

      return reply.status(400).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Manual snapshot
  app.post('/workflows/:id/snapshot', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;
    const body = parseWithSchema(snapshotBodySchema, request.body ?? {}, reply);
    if (body === null) return;
    const { label } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        variables: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    // Decrypt API key
    const apiKey = decryptFromDb(
      workflow.n8nInstance.apiKeyEncrypted,
      workflow.n8nInstance.apiKeyIv,
      workflow.n8nInstance.apiKeyTag
    );

    const client = createN8nClient({
      baseUrl: workflow.n8nInstance.baseUrl,
      apiKey,
    });

    try {
      const fullWorkflow = await client.getWorkflow(workflow.n8nWorkflowId);
      const hash = computeDeepHash(fullWorkflow);

      // Check if different from latest
      const latestHash = workflow.versions[0]?.hash;

      if (latestHash === hash) {
        return reply.send({
          success: true,
          created: false,
          message: 'No changes detected since last snapshot',
        });
      }

      const version = await prisma.workflowVersion.create({
        data: {
          organizationId: request.organizationId!,
          workflowId: id,
          hash,
          jsonContent: fullWorkflow as object,
          label: label || 'Manual snapshot',
          variablesSnapshot: workflow.variables.map((v) => ({
            key: v.key,
            value: v.value,
            isSecret: v.isSecret,
            description: v.description,
          })),
        },
      });

      // Update workflow
      await prisma.workflow.update({
        where: { id },
        data: {
          name: fullWorkflow.name,
          active: fullWorkflow.active,
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          organizationId: request.organizationId!,
          actorUserId: request.user!.id,
          action: 'workflow.snapshot',
          entityType: 'workflow',
          entityId: id,
          metadata: { versionId: version.id, label: version.label },
        },
      });

      return reply.send({
        success: true,
        created: true,
        version: {
          id: version.id,
          hash: version.hash.substring(0, 8),
          label: version.label,
          createdAt: version.createdAt.toISOString(),
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof N8nApiError
          ? error.message
          : 'Failed to snapshot workflow';

      return reply.status(400).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  app.post('/workflows/:id/quarantine', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const body = parseWithSchema(quarantineActionSchema, request.body ?? {}, reply);
    if (!body) return;

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, organizationId: request.organizationId! },
      include: {
        n8nInstance: true,
      },
    });
    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const result = await quarantineWorkflow({
      workflow,
      organizationId: request.organizationId!,
      action: body.action,
      reason: body.reason ?? 'Quarantaine déclenchée',
      actorUserId: request.user!.id,
      versionId: body.versionId,
      nodeNames: body.nodes,
    });

    return reply.send({
      success: true,
      status: 'quarantined',
      event: {
        id: result.event.id,
        action: result.event.action,
        createdAt: result.event.createdAt.toISOString(),
      },
    });
  });

  app.post('/workflows/:id/release', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, organizationId: request.organizationId! },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    await prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        status: 'active',
        quarantineSince: null,
        quarantineReason: null,
      },
    });

    await prisma.workflowQuarantineEvent.create({
      data: {
        organizationId: request.organizationId!,
        workflowId: workflow.id,
        action: 'release',
        metadata: {},
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'workflow.quarantine.released',
        entityType: 'workflow',
        entityId: workflow.id,
      },
    });

    return reply.send({ success: true });
  });

  // Rollback workflow to a specific version
  app.post('/workflows/:workflowId/rollback', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowParamWithWorkflowIdSchema, request.params, reply);
    if (!params) return;
    const { workflowId } = params;
    const body = parseWithSchema(rollbackBodySchema, request.body ?? {}, reply);
    if (!body) return;
    const { versionId } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const targetVersion = await prisma.workflowVersion.findFirst({
      where: {
        id: versionId,
        workflowId,
        organizationId: request.organizationId!,
      },
    });

    if (!targetVersion) {
      return reply.status(404).send({ error: 'Not Found', message: 'Version not found' });
    }

    // Decrypt API key
    const apiKey = decryptFromDb(
      workflow.n8nInstance.apiKeyEncrypted,
      workflow.n8nInstance.apiKeyIv,
      workflow.n8nInstance.apiKeyTag
    );

    const client = createN8nClient({
      baseUrl: workflow.n8nInstance.baseUrl,
      apiKey,
    });

    try {
      // Update workflow in n8n
      // Clean up the workflow content - remove read-only fields that n8n won't accept
      const workflowContent = targetVersion.jsonContent as Record<string, unknown>;
      const cleanedContent = {
        name: workflowContent.name,
        nodes: workflowContent.nodes,
        connections: workflowContent.connections,
        settings: workflowContent.settings,
        staticData: workflowContent.staticData,
        // Note: 'active' is read-only in n8n API, don't include it
      };
      
      console.log('[Rollback] Updating workflow:', workflow.n8nWorkflowId);
      await client.updateWorkflow(workflow.n8nWorkflowId, cleanedContent);

      // Create new version entry for the rollback
      const hash = computeDeepHash(workflowContent);
      const newVersion = await prisma.workflowVersion.create({
        data: {
          organizationId: request.organizationId!,
          workflowId,
          hash,
          jsonContent: workflowContent,
          label: `Rollback to version ${targetVersion.hash.substring(0, 8)}`,
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          organizationId: request.organizationId!,
          actorUserId: request.user!.id,
          action: 'workflow.rollback',
          entityType: 'workflow',
          entityId: workflowId,
          metadata: {
            fromVersionId: versionId,
            newVersionId: newVersion.id,
            targetHash: targetVersion.hash.substring(0, 8),
          },
        },
      });

      return reply.send({
        success: true,
        newVersion: {
          id: newVersion.id,
          hash: newVersion.hash.substring(0, 8),
          label: newVersion.label,
          createdAt: newVersion.createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('[Rollback] Error:', error);
      const errorMessage =
        error instanceof N8nApiError
          ? `${error.message} (${JSON.stringify(error.response)})`
          : error instanceof Error
            ? error.message
            : 'Failed to rollback workflow';

      // Log failure
      await prisma.auditLog.create({
        data: {
          organizationId: request.organizationId!,
          actorUserId: request.user!.id,
          action: 'workflow.rollback',
          entityType: 'workflow',
          entityId: workflowId,
          metadata: {
            targetVersionId: versionId,
            error: errorMessage,
            success: false,
          },
        },
      });

      await sendOrgNotification(request.organizationId!, {
        title: `Rollback échoué • ${workflow.name}`,
        body: `L'instance ${workflow.n8nInstance.name} n'a pas pu restaurer le workflow (${errorMessage}).`,
        url: buildWorkflowUrl(workflowId),
      });

      return reply.status(400).send({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Targeted restore (nodes/variables/singles)
  app.post('/workflows/:workflowId/restore', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowParamWithWorkflowIdSchema, request.params, reply);
    if (!params) return;
    const { workflowId } = params;
    const body = parseWithSchema(targetedRestoreSchema, request.body ?? {}, reply);
    if (!body) return;

    const { versionId, mode, nodeNames = [], includeConnections = true } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    try {
      const result = await performTargetedRestore({
        organizationId: request.organizationId!,
        workflow,
        versionId,
        mode,
        nodeNames,
        includeConnections,
        actorUserId: request.user!.id,
      });

      return reply.send({
        success: true,
        mode: result.mode,
        newVersion: result.newVersion,
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore workflow',
      });
    }
  });

  // Get workflow executions
  app.get('/workflows/:id/executions', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id: workflowId } = params;
    const query = parseWithSchema(executionsQuerySchema, request.query, reply);
    if (!query) return;
    const { limit, refresh } = query;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    // If refresh=true, fetch from n8n and sync
    if (refresh === 'true') {
      try {
        const apiKey = decryptFromDb(
          workflow.n8nInstance.apiKeyEncrypted,
          workflow.n8nInstance.apiKeyIv,
          workflow.n8nInstance.apiKeyTag
        );

        const client = createN8nClient({
          baseUrl: workflow.n8nInstance.baseUrl,
          apiKey,
        });

        const n8nExecutions = await client.listExecutions({
          workflowId: workflow.n8nWorkflowId,
          limit,
        });

        // Upsert executions
        for (const exec of n8nExecutions) {
          const startedAt = new Date(exec.startedAt);
          const stoppedAt = exec.stoppedAt ? new Date(exec.stoppedAt) : null;
          const durationMs = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : null;

          await prisma.workflowExecution.upsert({
            where: {
              workflowId_n8nExecutionId: {
                workflowId: workflow.id,
                n8nExecutionId: exec.id,
              },
            },
            update: {
              status: exec.status,
              stoppedAt,
              durationMs,
              errorMessage: exec.data?.resultData?.error?.message ?? null,
            },
            create: {
              workflowId: workflow.id,
              n8nExecutionId: exec.id,
              status: exec.status,
              mode: exec.mode,
              startedAt,
              stoppedAt,
              durationMs,
              errorMessage: exec.data?.resultData?.error?.message ?? null,
            },
          });
        }

        const lastErrorExecution = n8nExecutions.find(
          (exec) => exec.status === 'error'
        );
        if (lastErrorExecution) {
          await maybeTriggerAutoQuarantine({
            workflowId: workflow.id,
            organizationId: workflow.organizationId,
            recentErrorMessage:
              lastErrorExecution.data?.resultData?.error?.message ?? null,
          });
        }
      } catch (error) {
        console.error('[Executions] Failed to refresh from n8n:', error);
        // Continue to return cached data
      }
    }

    // Get executions from DB
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return reply.send({
      executions: executions.map((e) => {
        const parsedError = e.errorMessage ? parseN8nError(e.errorMessage) : null;
        return {
          id: e.id,
          n8nExecutionId: e.n8nExecutionId,
          status: e.status,
          mode: e.mode,
          startedAt: e.startedAt.toISOString(),
          stoppedAt: e.stoppedAt?.toISOString() ?? null,
          durationMs: e.durationMs,
          errorMessage: e.errorMessage,
          parsedError: parsedError ? {
            nodeName: parsedError.nodeName,
            errorType: parsedError.errorType,
            shortMessage: parsedError.shortMessage,
            suggestion: parsedError.suggestion,
            severity: getErrorSeverity(parsedError.errorType),
          } : null,
        };
      }),
    });
  });

  // Get workflow errors (failed executions with parsed info)
  app.get('/workflows/:id/errors', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id: workflowId } = params;
    const query = parseWithSchema(errorsQuerySchema, request.query, reply);
    if (!query) return;
    const { limit, errorType } = query;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId: request.organizationId!,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    // Get failed executions
    const executions = await prisma.workflowExecution.findMany({
      where: {
        workflowId,
        status: 'error',
        errorMessage: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    // Parse all errors
    const errors = executions.map((e) => {
      const parsed = parseN8nError(e.errorMessage);
      return {
        id: e.id,
        executionId: e.n8nExecutionId,
        startedAt: e.startedAt.toISOString(),
        nodeName: parsed.nodeName,
        nodeType: parsed.nodeType,
        errorType: parsed.errorType,
        shortMessage: parsed.shortMessage,
        fullMessage: parsed.fullMessage,
        suggestion: parsed.suggestion,
        severity: getErrorSeverity(parsed.errorType),
      };
    });

    // Filter by error type if specified
    const filteredErrors = errorType
      ? errors.filter((e) => e.errorType === errorType)
      : errors;

    // Group by error type for summary
    const errorSummary = errors.reduce((acc, err) => {
      acc[err.errorType] = (acc[err.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get most common error node
    const nodeErrorCount = errors.reduce((acc, err) => {
      if (err.nodeName) {
        acc[err.nodeName] = (acc[err.nodeName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const mostProblematicNode = Object.entries(nodeErrorCount).sort((a, b) => b[1] - a[1])[0];

    return reply.send({
      errors: filteredErrors,
      summary: {
        total: errors.length,
        byType: errorSummary,
        mostProblematicNode: mostProblematicNode
          ? { name: mostProblematicNode[0], count: mostProblematicNode[1] }
          : null,
      },
    });
  });

  // Sync executions for a workflow
  app.post('/workflows/:id/executions/sync', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id: workflowId } = params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id: workflowId,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    try {
      const apiKey = decryptFromDb(
        workflow.n8nInstance.apiKeyEncrypted,
        workflow.n8nInstance.apiKeyIv,
        workflow.n8nInstance.apiKeyTag
      );

      const client = createN8nClient({
        baseUrl: workflow.n8nInstance.baseUrl,
        apiKey,
      });

      const n8nExecutions = await client.listExecutions({
        workflowId: workflow.n8nWorkflowId,
        limit: 100,
      });

      let synced = 0;
      for (const exec of n8nExecutions) {
        const startedAt = new Date(exec.startedAt);
        const stoppedAt = exec.stoppedAt ? new Date(exec.stoppedAt) : null;
        const durationMs = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : null;

        await prisma.workflowExecution.upsert({
          where: {
            workflowId_n8nExecutionId: {
              workflowId: workflow.id,
              n8nExecutionId: exec.id,
            },
          },
          update: {
            status: exec.status,
            stoppedAt,
            durationMs,
            errorMessage: exec.data?.resultData?.error?.message ?? null,
          },
          create: {
            workflowId: workflow.id,
            n8nExecutionId: exec.id,
            status: exec.status,
            mode: exec.mode,
            startedAt,
            stoppedAt,
            durationMs,
            errorMessage: exec.data?.resultData?.error?.message ?? null,
          },
        });
        synced++;
      }

      const lastErrorExecution = n8nExecutions.find(
        (exec) => exec.status === 'error'
      );
      if (lastErrorExecution) {
        await maybeTriggerAutoQuarantine({
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          recentErrorMessage:
            lastErrorExecution.data?.resultData?.error?.message ?? null,
        });
      }

      return reply.send({
        success: true,
        synced,
      });
    } catch (error) {
      console.error('[Executions Sync] Error:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync executions',
      });
    }
  });

  // Update workflow (environment, etc.)
  app.patch('/workflows/:id', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;
    const body = parseWithSchema(workflowUpdateBodySchema, request.body ?? {}, reply);
    if (body === null) return;
    const { environment, status, quarantineConfig } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const updateData: Record<string, unknown> = {};

    if (environment) {
      updateData.environment = environment;
    }

    if (status && status !== workflow.status) {
      updateData.status = status;
      if (status === 'active') {
        updateData.quarantineSince = null;
        updateData.quarantineReason = null;
      }
    }

    if (quarantineConfig) {
      const mergedConfig = normalizeQuarantineConfig({
        ...(workflow.quarantineConfig as Record<string, unknown> | null),
        ...quarantineConfig,
      });
      updateData.quarantineConfig = mergedConfig;
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'workflow.updated',
        entityType: 'workflow',
        entityId: id,
        metadata: { changes: Object.keys(updateData) },
      },
    });

    return reply.send({
      success: true,
      workflow: {
        id: updated.id,
        environment: updated.environment,
      },
    });
  });

  // Get workflow variables
  app.get('/workflows/:id/variables', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
      include: { variables: true },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return reply.send({
      variables: workflow.variables.map(v => ({
        id: v.id,
        key: v.key,
        value: v.isSecret ? '••••••••' : v.value,
        isSecret: v.isSecret,
        description: v.description,
      })),
    });
  });

  // Add/update workflow variable
  app.post('/workflows/:id/variables', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;
    const body = parseWithSchema(variableBodySchema, request.body ?? {}, reply);
    if (!body) return;
    const { key, value, isSecret, description } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const variable = await prisma.workflowVariable.upsert({
      where: {
        workflowId_key: {
          workflowId: id,
          key,
        },
      },
      update: {
        value,
        isSecret: isSecret ?? false,
        description,
      },
      create: {
        workflowId: id,
        key,
        value,
        isSecret: isSecret ?? false,
        description,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'workflow.variable.set',
        entityType: 'workflow',
        entityId: id,
        metadata: { key, isSecret },
      },
    });

    return reply.send({
      success: true,
      variable: {
        id: variable.id,
        key: variable.key,
        value: variable.isSecret ? '••••••••' : variable.value,
        isSecret: variable.isSecret,
        description: variable.description,
      },
    });
  });

  // Delete workflow variable
  app.delete('/workflows/:id/variables/:variableId', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowVariableParamSchema, request.params, reply);
    if (!params) return;
    const { id, variableId } = params;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const variable = await prisma.workflowVariable.findFirst({
      where: {
        id: variableId,
        workflowId: id,
      },
    });

    if (!variable) {
      return reply.status(404).send({ error: 'Variable not found' });
    }

    await prisma.workflowVariable.delete({
      where: { id: variableId },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'workflow.variable.deleted',
        entityType: 'workflow',
        entityId: id,
        metadata: { key: variable.key },
      },
    });

    return reply.send({ success: true });
  });

  // Promote workflow to another environment
  app.post('/workflows/:id/promote', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const { id } = params;
    const body = parseWithSchema(promoteBodySchema, request.body ?? {}, reply);
    if (!body) return;
    const { targetEnvironment, targetInstanceId, copyVariables } = body;

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        organizationId: request.organizationId!,
      },
      include: {
        n8nInstance: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        variables: true,
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    // Get the target instance (same or different)
    const targetInstance = targetInstanceId
      ? await prisma.n8nInstance.findFirst({
          where: {
            id: targetInstanceId,
            organizationId: request.organizationId!,
          },
        })
      : workflow.n8nInstance;

    if (!targetInstance) {
      return reply.status(404).send({ error: 'Target instance not found' });
    }

    // Get the latest version content
    const latestVersion = workflow.versions[0];
    if (!latestVersion) {
      return reply.status(400).send({ error: 'No version to promote' });
    }

    try {
      // If promoting to a different instance, we need to create the workflow in n8n
      if (targetInstance.id !== workflow.n8nInstanceId) {
        const workflowCapacity = await getWorkflowLimitSnapshot(request.organizationId!);
        if (workflowCapacity.count >= workflowCapacity.limit) {
          return reply.status(402).send({
            error: 'Workflow limit reached',
            message: `Your ${workflowCapacity.context.definition.name} plan allows ${workflowCapacity.limit} workflow${workflowCapacity.limit === 1 ? '' : 's'}. Upgrade to promote to another environment.`,
          });
        }

        const apiKey = decryptFromDb(
          targetInstance.apiKeyEncrypted,
          targetInstance.apiKeyIv,
          targetInstance.apiKeyTag
        );

        const client = createN8nClient({
          baseUrl: targetInstance.baseUrl,
          apiKey,
        });

        // Create workflow in target n8n
        const workflowContent = latestVersion.jsonContent as Record<string, unknown>;
        const newN8nWorkflow = await client.createWorkflow({
          name: `${workflow.name} (${targetEnvironment})`,
          nodes: workflowContent.nodes,
          connections: workflowContent.connections,
          settings: workflowContent.settings,
        });

        // Create new workflow record in our DB
        const promotedWorkflow = await prisma.workflow.create({
          data: {
            organizationId: request.organizationId!,
            n8nInstanceId: targetInstance.id,
            n8nWorkflowId: newN8nWorkflow.id,
            name: workflow.name,
            active: false,
            environment: targetEnvironment,
            promotedFrom: workflow.id,
            promotedAt: new Date(),
          },
        });

        // Create initial version
        await prisma.workflowVersion.create({
          data: {
            organizationId: request.organizationId!,
            workflowId: promotedWorkflow.id,
            hash: latestVersion.hash,
            jsonContent: latestVersion.jsonContent as object,
            label: `Promoted from ${workflow.environment}`,
          },
        });

        // Copy variables if requested
        if (copyVariables && workflow.variables.length > 0) {
          for (const v of workflow.variables) {
            await prisma.workflowVariable.create({
              data: {
                workflowId: promotedWorkflow.id,
                key: v.key,
                value: v.value,
                isSecret: v.isSecret,
                description: v.description,
              },
            });
          }
        }

        await prisma.auditLog.create({
          data: {
            organizationId: request.organizationId!,
            actorUserId: request.user!.id,
            action: 'workflow.promoted',
            entityType: 'workflow',
            entityId: id,
            metadata: {
              sourceEnvironment: workflow.environment,
              targetEnvironment,
              targetInstanceId: targetInstance.id,
              newWorkflowId: promotedWorkflow.id,
            },
          },
        });

        return reply.send({
          success: true,
          promotedWorkflow: {
            id: promotedWorkflow.id,
            name: promotedWorkflow.name,
            environment: promotedWorkflow.environment,
            instanceName: targetInstance.name,
          },
        });
      } else {
        // Same instance - just update environment
        const updated = await prisma.workflow.update({
          where: { id },
          data: {
            environment: targetEnvironment,
            promotedAt: new Date(),
          },
        });

        await prisma.auditLog.create({
          data: {
            organizationId: request.organizationId!,
            actorUserId: request.user!.id,
            action: 'workflow.promoted',
            entityType: 'workflow',
            entityId: id,
            metadata: {
              sourceEnvironment: workflow.environment,
              targetEnvironment,
              sameInstance: true,
            },
          },
        });

        return reply.send({
          success: true,
          promotedWorkflow: {
            id: updated.id,
            name: updated.name,
            environment: updated.environment,
            instanceName: workflow.n8nInstance.name,
          },
        });
      }
    } catch (error) {
      console.error('[Promote] Error:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to promote workflow',
      });
    }
  });

  // Promotion requests
  app.post('/workflows/:id/promotion-requests', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;
    const body = parseWithSchema(promotionRequestBodySchema, request.body ?? {}, reply);
    if (!body) return;

    const workflow = await prisma.workflow.findFirst({
      where: { id: params.id, organizationId: request.organizationId! },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const checklist = body.checklist.map((item) => ({
      key: item.key,
      label: item.label,
      status: item.status,
      required: item.required,
    }));

    const latestVersion = workflow.versions[0];

    const requestRecord = await prisma.promotionRequest.create({
      data: {
        organizationId: request.organizationId!,
        workflowId: workflow.id,
        sourceVersionId: latestVersion?.id ?? null,
        targetEnvironment: body.targetEnvironment,
        targetInstanceId: body.targetInstanceId ?? null,
        status: 'draft',
        checklist,
        notes: body.notes,
        createdById: request.user!.id,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            n8nInstance: { select: { name: true } },
          },
        },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'promotion.request.created',
        entityType: 'workflow',
        entityId: workflow.id,
        metadata: {
          promotionRequestId: requestRecord.id,
          targetEnvironment: body.targetEnvironment,
        },
      },
    });

    return reply.send({
      promotionRequest: {
        ...requestRecord,
        checklist,
      },
    });
  });

  app.get('/workflows/:id/promotion-requests', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(workflowIdParamSchema, request.params, reply);
    if (!params) return;

    const promotions = await prisma.promotionRequest.findMany({
      where: {
        workflowId: params.id,
        organizationId: request.organizationId!,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        reviewer: { select: { id: true, email: true, name: true } },
      },
    });

    return reply.send({
      promotionRequests: promotions,
    });
  });

  app.patch('/promotion-requests/:requestId/checklist', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(z.object({ requestId: stringIdSchema }), request.params, reply);
    if (!params) return;
    const body = parseWithSchema(promotionChecklistSchema, request.body ?? {}, reply);
    if (!body) return;

    const promotion = await prisma.promotionRequest.findFirst({
      where: { id: params.requestId, organizationId: request.organizationId! },
    });

    if (!promotion) {
      return reply.status(404).send({ error: 'Promotion request not found' });
    }

    const updatedChecklist = promotion.checklist.map((item: any) => {
      const incoming = body.checks.find((check) => check.key === item.key);
      if (!incoming) return item;
      return {
        ...item,
        status: incoming.status,
        notes: incoming.notes ?? item.notes,
        updatedAt: new Date().toISOString(),
        updatedBy: request.user!.id,
      };
    });

    await prisma.promotionRequest.update({
      where: { id: promotion.id },
      data: { checklist: updatedChecklist, updatedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'promotion.request.checklist.updated',
        entityType: 'workflow',
        entityId: promotion.workflowId,
        metadata: {
          promotionRequestId: promotion.id,
          checklist: updatedChecklist,
        },
      },
    });

    return reply.send({
      success: true,
      checklist: updatedChecklist,
    });
  });

  app.post('/promotion-requests/:requestId/status', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const params = parseWithSchema(z.object({ requestId: stringIdSchema }), request.params, reply);
    if (!params) return;
    const body = parseWithSchema(promotionRequestStatusSchema, request.body ?? {}, reply);
    if (!body) return;

    const promotion = await prisma.promotionRequest.findFirst({
      where: { id: params.requestId, organizationId: request.organizationId! },
    });

    if (!promotion) {
      return reply.status(404).send({ error: 'Promotion request not found' });
    }

    if (body.status === 'approved') {
      const pendingRequired = promotion.checklist.some(
        (check: any) => check.required && check.status !== 'pass'
      );
      if (pendingRequired) {
        return reply.status(400).send({
          error: 'Checklist pending',
          message: 'All required checks must pass before approval.',
        });
      }
    }

    const updated = await prisma.promotionRequest.update({
      where: { id: promotion.id },
      data: {
        status: body.status,
        reviewerId: request.user!.id,
        approvedAt: body.status === 'approved' ? new Date() : null,
        notes: body.notes ?? promotion.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'promotion.request.status',
        entityType: 'workflow',
        entityId: promotion.workflowId,
        metadata: {
          promotionRequestId: promotion.id,
          status: body.status,
          notes: body.notes,
        },
      },
    });

    return reply.send({
      promotionRequest: updated,
    });
  });
  // end promotion requests
}
const promotionRequestBodySchema = z.object({
  targetEnvironment: z.string().min(1).max(32),
  targetInstanceId: z.string().min(1).max(128).optional(),
  copyVariables: z.boolean().default(true),
  checklist: z.array(z.object({
    key: z.string(),
    label: z.string(),
    status: z.enum(['pending', 'pass', 'fail']).default('pending'),
    required: z.boolean().default(true),
  })).default([
    { key: 'tests', label: 'Automated tests passed', status: 'pending', required: true },
    { key: 'qa', label: 'QA review complete', status: 'pending', required: true },
    { key: 'compliance', label: 'Compliance review', status: 'pending', required: false },
  ]),
  notes: z.string().max(500).optional(),
});

const promotionRequestStatusSchema = z.object({
  status: z.enum(['ready_for_review', 'approved', 'rejected']),
  notes: z.string().max(500).optional(),
});

const promotionChecklistSchema = z.object({
  checks: z.array(z.object({
    key: z.string(),
    status: z.enum(['pending', 'pass', 'fail']),
    notes: z.string().max(500).optional(),
  })),
});
