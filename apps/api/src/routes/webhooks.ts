import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createN8nClient } from '../lib/n8n-client.js';
import { decryptFromDb } from '../lib/encryption.js';
import { computeWorkflowHash } from '../lib/hash.js';
import { parseWithSchema } from '../lib/validation.js';
import { getWorkflowLimitSnapshot } from '../lib/plans.js';
import { maybeTriggerAutoQuarantine } from '../lib/workflow-actions.js';

const webhookParamSchema = z.object({
  instanceId: z.string().min(1).max(128),
});

const webhookQuerySchema = z.object({
  secret: z.string().min(8).max(256).optional(),
});

const webhookPayloadSchema = z.object({
  event: z.string().optional(),
  workflowId: z.string().min(1).max(128).optional(),
  workflow: z.object({
    id: z.string().min(1).max(128).optional(),
    name: z.string().optional(),
    active: z.boolean().optional(),
    nodes: z.array(z.unknown()).optional(),
    connections: z.unknown().optional(),
    settings: z.unknown().optional(),
  }).optional(),
  execution: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
    mode: z.string().optional(),
    startedAt: z.string().optional(),
    stoppedAt: z.string().optional(),
    waitTill: z.string().optional(),
    error: z
      .object({
        message: z.string().optional(),
        stack: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
  }).optional(),
});

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function isValidSignature(secret: string, signature: string, timestamp: string, workflowId?: string): boolean {
  if (!timestamp || !signature) return false;
  const timestampInt = Number(timestamp);
  if (!Number.isFinite(timestampInt) || Math.abs(Date.now() - timestampInt) > 5 * 60 * 1000) {
    return false;
  }

  const payloadToSign = `${timestampInt}.${workflowId ?? ''}`;
  const computed = crypto.createHmac('sha256', secret).update(payloadToSign).digest();
  const provided = Buffer.from(signature, 'hex');

  return computed.length === provided.length && crypto.timingSafeEqual(computed, provided);
}

export async function webhookRoutes(app: FastifyInstance) {
  // Webhook endpoint for n8n to call when a workflow changes
  // URL format: POST /webhooks/n8n/:instanceId?secret=xxx
  app.post('/webhooks/n8n/:instanceId', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const params = parseWithSchema(webhookParamSchema, request.params, reply);
    if (!params) return;
    const query = parseWithSchema(webhookQuerySchema, request.query ?? {}, reply);
    if (!query) return;
    const payload = parseWithSchema(webhookPayloadSchema, request.body ?? {}, reply);
    if (!payload) return;
    const { instanceId } = params;
    const { secret } = query;

    console.log(`[Webhook] Received for instance ${instanceId}`, {
      event: payload.event,
      workflowId: payload.workflowId || payload.workflow?.id,
    });

    // Find the instance
    const instance = await prisma.n8nInstance.findUnique({
      where: { id: instanceId },
      include: { organization: true },
    });

    if (!instance) {
      console.log(`[Webhook] Instance not found: ${instanceId}`);
      return reply.status(404).send({ success: false, error: 'Instance not found' });
    }

    // Validate webhook secret if configured
    if (instance.webhookSecret) {
      const signatureHeader = request.headers['x-flowvault-signature'];
      const timestampHeader = request.headers['x-flowvault-timestamp'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
      const workflowIdentifier = payload.workflowId || payload.workflow?.id;

      const signatureValid = signature && timestamp
        ? isValidSignature(instance.webhookSecret, signature, timestamp, workflowIdentifier)
        : false;

      if (!signatureValid) {
        if (!secret || !safeEqual(instance.webhookSecret, secret)) {
          console.log(`[Webhook] Invalid authentication for instance ${instanceId}`);
          return reply.status(401).send({ success: false, error: 'Invalid webhook signature' });
        }
      }
    }

    const eventType = payload.event ?? 'workflow.updated';
    const n8nWorkflowId =
      payload.workflowId ||
      payload.workflow?.id ||
      (payload.execution?.workflowId ? String(payload.execution.workflowId) : undefined);

    if (!n8nWorkflowId) {
      console.log(`[Webhook] No workflow ID in payload, acknowledging`);
      return reply.send({ success: true, message: 'Webhook received, no workflow to process' });
    }

    try {
      // Decrypt API key
      const apiKey = decryptFromDb(
        instance.apiKeyEncrypted,
        instance.apiKeyIv,
        instance.apiKeyTag
      );

      const n8nClient = createN8nClient({
        baseUrl: instance.baseUrl,
        apiKey,
      });

      // Find or create the workflow in our DB
      let workflow = await prisma.workflow.findFirst({
        where: {
          n8nInstanceId: instance.id,
          n8nWorkflowId: n8nWorkflowId,
        },
      });

      const ensureWorkflow = async () => {
        const n8nWorkflow = await n8nClient.getWorkflow(n8nWorkflowId);
        if (!workflow) {
          const capacity = await getWorkflowLimitSnapshot(instance.organizationId);
          if (capacity.count >= capacity.limit) {
            console.log(`[Webhook] Workflow limit reached for org ${instance.organizationId}`);
            return { n8nWorkflow, created: false, limitReached: true };
          }
          workflow = await prisma.workflow.create({
            data: {
              organizationId: instance.organizationId,
              n8nInstanceId: instance.id,
              n8nWorkflowId: n8nWorkflowId,
              name: n8nWorkflow.name,
              active: n8nWorkflow.active,
            },
          });
          console.log(`[Webhook] Created new workflow: ${workflow.id}`);
        } else {
          await prisma.workflow.update({
            where: { id: workflow.id },
            data: {
              name: n8nWorkflow.name,
              active: n8nWorkflow.active,
            },
          });
        }
        return { n8nWorkflow, created: true, limitReached: false };
      };

      const recordExecutionEvent = async () => {
        if (!workflow) {
          const { limitReached } = await ensureWorkflow();
          if (limitReached) {
            return reply.status(402).send({
              success: false,
              error: 'Workflow limit reached',
            });
          }
        }
        if (!workflow) {
          return reply.send({ success: false, message: 'Workflow not available' });
        }

        const executionId = payload.execution?.id
          ? String(payload.execution.id)
          : `${Date.now()}`;
        const startedAt = payload.execution?.startedAt
          ? new Date(payload.execution.startedAt)
          : new Date();
        const stoppedAt = payload.execution?.stoppedAt
          ? new Date(payload.execution.stoppedAt)
          : new Date();
        const durationMs = Math.max(0, stoppedAt.getTime() - startedAt.getTime());
        const status = payload.execution?.status?.toLowerCase() ??
          (payload.execution?.error ? 'error' : 'success');
        const mode = payload.execution?.mode ?? 'trigger';
        const errorMessage =
          payload.execution?.error?.message ||
          payload.execution?.error?.description ||
          null;

        await prisma.workflowExecution.upsert({
          where: {
            workflowId_n8nExecutionId: {
              workflowId: workflow.id,
              n8nExecutionId: executionId,
            },
          },
          update: {
            status,
            mode,
            startedAt,
            stoppedAt,
            durationMs,
            errorMessage,
          },
          create: {
            workflowId: workflow.id,
            n8nExecutionId: executionId,
            status,
            mode,
            startedAt,
            stoppedAt,
            durationMs,
            errorMessage,
          },
        });

        if (status === 'error') {
          await maybeTriggerAutoQuarantine({
            workflowId: workflow.id,
            organizationId: workflow.organizationId,
            recentErrorMessage: errorMessage,
          });
        }

        return reply.send({
          success: true,
          message: 'Execution recorded',
          workflowId: workflow.id,
        });
      };

      const isExecutionEvent =
        !!payload.execution &&
        (eventType.includes('execution') || eventType === 'workflow.execution.completed');

      if (isExecutionEvent) {
        return await recordExecutionEvent();
      }

      const { n8nWorkflow, limitReached } = await ensureWorkflow();

      if (limitReached) {
        return reply.status(402).send({
          success: false,
          error: 'Workflow limit reached',
          message: 'Upgrade to keep tracking new workflows.',
        });
      }

      // Prepare workflow content for hashing
      const workflowContent = {
        nodes: n8nWorkflow.nodes,
        connections: n8nWorkflow.connections,
        settings: n8nWorkflow.settings,
      };

      const contentHash = computeWorkflowHash(workflowContent);

      // Check if this version already exists
      const existingVersion = await prisma.workflowVersion.findFirst({
        where: {
          workflowId: workflow.id,
          hash: contentHash,
        },
      });

      if (existingVersion) {
        console.log(`[Webhook] Version already exists for workflow ${workflow.id}, hash: ${contentHash.substring(0, 8)}`);
        return reply.send({
          success: true,
          message: 'No changes detected',
          workflowId: workflow.id,
        });
      }

      // Get the next version number
      const lastVersion = await prisma.workflowVersion.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { versionNumber: 'desc' },
      });

      const versionNumber = (lastVersion?.versionNumber || 0) + 1;

      // Create new version
      const newVersion = await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber,
          hash: contentHash,
          jsonContent: workflowContent as any,
          label: 'webhook',
        },
      });

      // Update workflow's lastSnapshotAt
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { lastSnapshotAt: new Date() },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          organizationId: instance.organizationId,
          action: 'workflow.snapshot.webhook',
          entityType: 'workflow',
          entityId: workflow.id,
          metadata: {
            versionNumber,
            hash: contentHash,
            source: 'webhook',
          },
        },
      });

      console.log(`[Webhook] Created version ${versionNumber} for workflow ${workflow.id}`);

      return reply.send({
        success: true,
        message: 'New version created',
        workflowId: workflow.id,
        versionNumber,
        hash: contentHash,
      });

    } catch (error) {
      console.error(`[Webhook] Error processing:`, error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process webhook',
      });
    }
  });

  // Health check endpoint for webhooks
  app.get('/webhooks/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
