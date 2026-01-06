import type { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, orgMiddleware, ownerMiddleware } from '../middleware/auth.js';
import { encryptForDb, decryptFromDb } from '../lib/encryption.js';
import { sendOrgNotification } from '../lib/notifications.js';
import { parseN8nError, getErrorSeverity } from '../lib/error-parser.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEB_APP_URL = process.env.WEB_URL || 'http://localhost:3000';

function parseEmailsInput(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return raw
    .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
    .filter((email) => EMAIL_REGEX.test(email));
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Get settings
  app.get('/settings', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const settings = await prisma.orgSettings.findUnique({
      where: { organizationId: request.organizationId! },
    });

    const org = await prisma.organization.findUnique({
      where: { id: request.organizationId! },
    });

    const ssoConfig = await prisma.orgSsoConfig.findUnique({
      where: { organizationId: request.organizationId! },
    });

    const alertEmails = parseEmailsInput(settings?.alertEmails ?? []);

    return reply.send({
      organizationName: org?.name,
      hasSlackWebhook: !!settings?.slackWebhookUrlEncrypted,
      hasTeamsWebhook: !!settings?.teamsWebhookUrlEncrypted,
      hasCustomWebhook: !!settings?.customWebhookUrlEncrypted,
      alertEmails,
      ssoConfig: ssoConfig
        ? {
            enabled: ssoConfig.enabled,
            provider: ssoConfig.provider,
            domainHint: ssoConfig.domainHint,
            issuerUrl: ssoConfig.issuerUrl,
            loginUrl: ssoConfig.loginUrl,
            audience: ssoConfig.audience,
            defaultRole: ssoConfig.defaultRole,
            enforceForAll: ssoConfig.enforceForAll,
            hasSharedSecret: !!ssoConfig.sharedSecretEncrypted,
            updatedAt: ssoConfig.updatedAt?.toISOString?.() ?? null,
          }
        : null,
    });
  });

  // Update settings
  app.patch('/settings', {
    preHandler: [authMiddleware, orgMiddleware, ownerMiddleware],
  }, async (request, reply) => {
    const {
      slackWebhookUrl,
      teamsWebhookUrl,
      customWebhookUrl,
      alertEmails,
      ssoConfig,
    } = request.body as {
      slackWebhookUrl?: string | null;
      teamsWebhookUrl?: string | null;
      customWebhookUrl?: string | null;
      alertEmails?: string[] | string | null;
      ssoConfig?: {
        provider?: string;
        domainHint?: string | null;
        issuerUrl?: string | null;
        loginUrl?: string | null;
        audience?: string | null;
        defaultRole?: string;
        enforceForAll?: boolean;
        enabled?: boolean;
        sharedSecret?: string | null;
      };
    };

    const updateData: Record<string, unknown> = {};
    const ssoProviders = new Set(['okta', 'azure', 'google', 'onelogin', 'generic']);
    let ssoConfigChanged = false;

    const handleWebhookUpdate = (
      value: string | null | undefined,
      fieldPrefix: 'slackWebhookUrl' | 'teamsWebhookUrl' | 'customWebhookUrl',
      hostnameValidator?: (hostname: string) => boolean,
      errorMessage?: string
    ) => {
      if (value === undefined) {
        return false;
      }

      if (!value) {
        updateData[`${fieldPrefix}Encrypted`] = null;
        updateData[`${fieldPrefix}Iv`] = null;
        updateData[`${fieldPrefix}Tag`] = null;
        return false;
      }

      try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
        if (hostnameValidator && !hostnameValidator(url.hostname)) {
          throw new Error(errorMessage || 'Invalid webhook host');
        }
      } catch (err) {
        reply.status(400).send({
          error: 'Bad Request',
          message: err instanceof Error ? err.message : 'Invalid URL',
        });
        return true;
      }

      const encrypted = encryptForDb(value);
      updateData[`${fieldPrefix}Encrypted`] = encrypted.encrypted;
      updateData[`${fieldPrefix}Iv`] = encrypted.iv;
      updateData[`${fieldPrefix}Tag`] = encrypted.tag;
      return false;
    };

    if (
      handleWebhookUpdate(
        slackWebhookUrl,
        'slackWebhookUrl',
        (hostname) => hostname.includes('slack.com'),
        'Must be a Slack webhook URL'
      )
    ) {
      return;
    }

    if (
      handleWebhookUpdate(
        teamsWebhookUrl,
        'teamsWebhookUrl',
        (hostname) => hostname.includes('office.com') || hostname.includes('microsoft.com'),
        'Must be a Microsoft Teams webhook URL'
      )
    ) {
      return;
    }

    if (handleWebhookUpdate(customWebhookUrl, 'customWebhookUrl')) {
      return;
    }

    if (alertEmails !== undefined) {
      const emails = parseEmailsInput(alertEmails);
      if (
        (Array.isArray(alertEmails) && alertEmails.length > 0 && emails.length !== alertEmails.length) ||
        (typeof alertEmails === 'string' && alertEmails.trim().length > 0 && emails.length === 0)
      ) {
        reply.status(400).send({
          error: 'Bad Request',
          message: 'One or more email addresses are invalid',
        });
        return;
      }
      updateData.alertEmails = emails;
    }

    if (ssoConfig !== undefined) {
      const {
        provider,
        domainHint,
        issuerUrl,
        loginUrl,
        audience,
        defaultRole,
        enforceForAll,
        enabled,
        sharedSecret,
      } = ssoConfig;

      if (provider && !ssoProviders.has(provider)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'SSO provider not supported',
        });
      }

      if (domainHint && !domainHint.includes('.')) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'SSO domain hint must be a valid domain',
        });
      }

      if (issuerUrl) {
        try {
          new URL(issuerUrl);
        } catch {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Issuer URL is invalid',
          });
        }
      }

      if (loginUrl) {
        try {
          new URL(loginUrl);
        } catch {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Login URL is invalid',
          });
        }
      }

      if (defaultRole && !['owner', 'member'].includes(defaultRole)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Default role must be owner or member',
        });
      }

      const ssoUpdateData: Record<string, unknown> = {};
      if (provider) ssoUpdateData.provider = provider;
      if (domainHint !== undefined) ssoUpdateData.domainHint = domainHint;
      if (issuerUrl !== undefined) ssoUpdateData.issuerUrl = issuerUrl;
      if (loginUrl !== undefined) ssoUpdateData.loginUrl = loginUrl;
      if (audience !== undefined) ssoUpdateData.audience = audience;
      if (defaultRole) ssoUpdateData.defaultRole = defaultRole;
      if (typeof enforceForAll === 'boolean') ssoUpdateData.enforceForAll = enforceForAll;
      if (typeof enabled === 'boolean') ssoUpdateData.enabled = enabled;

      if (sharedSecret !== undefined) {
        if (!sharedSecret) {
          ssoUpdateData.sharedSecretEncrypted = null;
          ssoUpdateData.sharedSecretIv = null;
          ssoUpdateData.sharedSecretTag = null;
        } else {
          const encryptedSecret = encryptForDb(sharedSecret);
          ssoUpdateData.sharedSecretEncrypted = encryptedSecret.encrypted;
          ssoUpdateData.sharedSecretIv = encryptedSecret.iv;
          ssoUpdateData.sharedSecretTag = encryptedSecret.tag;
        }
      }

      await prisma.orgSsoConfig.upsert({
        where: { organizationId: request.organizationId! },
        update: ssoUpdateData,
        create: {
          organizationId: request.organizationId!,
          provider: provider || 'generic',
          domainHint: domainHint || null,
          issuerUrl: issuerUrl || null,
          loginUrl: loginUrl || null,
          audience: audience || null,
          defaultRole: defaultRole || 'member',
          enabled: typeof enabled === 'boolean' ? enabled : true,
          enforceForAll: enforceForAll ?? false,
          ...(sharedSecret
            ? (() => {
                const encryptedSecret = encryptForDb(sharedSecret);
                return {
                  sharedSecretEncrypted: encryptedSecret.encrypted,
                  sharedSecretIv: encryptedSecret.iv,
                  sharedSecretTag: encryptedSecret.tag,
                };
              })()
            : {}),
        },
      });

      ssoConfigChanged = true;
    }

    await prisma.orgSettings.upsert({
      where: { organizationId: request.organizationId! },
      update: updateData,
      create: {
        organizationId: request.organizationId!,
        ...updateData,
      },
    });

    const changeSet = [
      ...Object.keys(updateData),
      ...(ssoConfigChanged ? ['ssoConfig'] : []),
    ];

    if (changeSet.length > 0) {
      await prisma.auditLog.create({
        data: {
          organizationId: request.organizationId!,
          actorUserId: request.user!.id,
          action: 'settings.updated',
          entityType: 'org_settings',
          entityId: request.organizationId!,
          metadata: { changes: changeSet },
        },
      });
    }

    return reply.send({ success: true });
  });

  // Test notification channels
  app.post('/settings/test-notifications', {
    preHandler: [authMiddleware, orgMiddleware, ownerMiddleware],
  }, async (request, reply) => {
    await sendOrgNotification(request.organizationId!, {
      title: 'Test FlowVault',
      body: 'Ceci est un test de notification multi-canal.',
      url: `${WEB_APP_URL}/app`,
    });

    return reply.send({ success: true });
  });

  // Generate a sample SSO payload
  app.post('/settings/sso/test', {
    preHandler: [authMiddleware, orgMiddleware, ownerMiddleware],
  }, async (request, reply) => {
    const body = request.body as { email?: string; externalId?: string };

    const config = await prisma.orgSsoConfig.findUnique({
      where: { organizationId: request.organizationId! },
    });

    if (!config || !config.sharedSecretEncrypted || !config.sharedSecretIv || !config.sharedSecretTag) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Configure an SSO shared secret before testing.',
      });
    }

    const email = body.email || (config.domainHint ? `john.doe@${config.domainHint}` : 'john.doe@example.com');
    const externalId = body.externalId || `ext-${randomBytes(6).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const nonce = randomBytes(8).toString('hex');

    const sharedSecret = decryptFromDb(
      config.sharedSecretEncrypted,
      config.sharedSecretIv,
      config.sharedSecretTag
    );

    const payload = `${email}|${externalId}|${timestamp}|${nonce}`;
    const signature = createHmac('sha256', sharedSecret).update(payload).digest('hex');

    return reply.send({
      payload: {
        email,
        externalId,
        timestamp,
        nonce,
      },
      signature,
      callbackUrl: `${process.env.API_URL || process.env.WEB_URL || 'http://localhost:3000'}/auth/sso/assert`,
      instructions: 'Compute HMAC SHA-256 over "email|externalId|timestamp|nonce" with the configured shared secret.',
    });
  });

  // Get audit logs
  app.get('/audit-logs', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: request.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        actor: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return reply.send({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        actor: log.actor
          ? {
              id: log.actor.id,
              email: log.actor.email,
              name: log.actor.name,
            }
          : null,
        createdAt: log.createdAt.toISOString(),
      })),
    });
  });

  // Sync all executions from all instances (global sync)
  app.post('/sync-all-executions', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { createN8nClient } = await import('../lib/n8n-client.js');

    // Get all instances for this org
    const instances = await prisma.n8nInstance.findMany({
      where: { organizationId: request.organizationId! },
      include: {
        workflows: {
          select: { id: true, n8nWorkflowId: true },
        },
      },
    });

    let totalSynced = 0;
    let totalErrors = 0;
    const results: Array<{ instanceName: string; synced: number; errors: number }> = [];

    for (const instance of instances) {
      let instanceSynced = 0;
      let instanceErrors = 0;

      try {
        const apiKey = decryptFromDb(
          instance.apiKeyEncrypted,
          instance.apiKeyIv,
          instance.apiKeyTag
        );

        const client = createN8nClient({
          baseUrl: instance.baseUrl,
          apiKey,
        });

        // Fetch all executions (especially errors) from this instance
        const executions = await client.listExecutions({
          limit: 100,
          includeData: true,
        });

        for (const exec of executions) {
          // Find the corresponding workflow in our DB
          const workflow = instance.workflows.find(w => w.n8nWorkflowId === exec.workflowId);
          if (!workflow) continue;

          const startedAt = new Date(exec.startedAt);
          const stoppedAt = exec.stoppedAt ? new Date(exec.stoppedAt) : null;
          const durationMs = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : null;

          // Extract error message from execution data
          let errorMessage: string | null = null;
          if (exec.status === 'error' && exec.data?.resultData?.error) {
            const error = exec.data.resultData.error;
            errorMessage = error.message || JSON.stringify(error);
            if (error.node?.name) {
              errorMessage = `Node '${error.node.name}': ${errorMessage}`;
            }
          }

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
              errorMessage,
            },
            create: {
              workflowId: workflow.id,
              n8nExecutionId: exec.id,
              status: exec.status,
              mode: exec.mode,
              startedAt,
              stoppedAt,
              durationMs,
              errorMessage,
            },
          });
          
          instanceSynced++;
          if (exec.status === 'error') instanceErrors++;
        }
      } catch (error) {
        console.error(`[GlobalSync] Failed to sync instance ${instance.name}:`, error);
      }

      results.push({
        instanceName: instance.name,
        synced: instanceSynced,
        errors: instanceErrors,
      });
      totalSynced += instanceSynced;
      totalErrors += instanceErrors;
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        organizationId: request.organizationId!,
        actorUserId: request.user!.id,
        action: 'executions.global_sync',
        entityType: 'organization',
        entityId: request.organizationId!,
        metadata: { totalSynced, totalErrors, instances: results },
      },
    });

    return reply.send({
      success: true,
      totalSynced,
      totalErrors,
      results,
    });
  });

  // Get all recent errors across workflows
  app.get('/errors', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { limit = '20' } = request.query as { limit?: string };

    // Get all workflows for this org
    const workflows = await prisma.workflow.findMany({
      where: { organizationId: request.organizationId! },
      select: { id: true, name: true, n8nInstance: { select: { name: true } } },
    });

    const workflowIds = workflows.map((w) => w.id);
    const workflowMap = new Map(workflows.map((w) => [w.id, { name: w.name, instanceName: w.n8nInstance.name }]));

    // Get failed executions
    const executions = await prisma.workflowExecution.findMany({
      where: {
        workflowId: { in: workflowIds },
        status: 'error',
        errorMessage: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: parseInt(limit),
    });

    // Parse errors
    const errors = executions.map((e) => {
      const parsed = parseN8nError(e.errorMessage);
      const workflow = workflowMap.get(e.workflowId);
      return {
        id: e.id,
        workflowId: e.workflowId,
        workflowName: workflow?.name || 'Unknown',
        instanceName: workflow?.instanceName || 'Unknown',
        executionId: e.n8nExecutionId,
        startedAt: e.startedAt.toISOString(),
        nodeName: parsed.nodeName,
        errorType: parsed.errorType,
        shortMessage: parsed.shortMessage,
        suggestion: parsed.suggestion,
        severity: getErrorSeverity(parsed.errorType),
      };
    });

    // Summary stats
    const errorCount = errors.length;
    const criticalCount = errors.filter((e) => e.severity === 'critical').length;
    const warningCount = errors.filter((e) => e.severity === 'warning').length;

    // Most affected workflow
    const workflowErrorCounts = errors.reduce((acc, e) => {
      acc[e.workflowId] = (acc[e.workflowId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostAffectedWorkflowId = Object.entries(workflowErrorCounts).sort((a, b) => b[1] - a[1])[0];
    const mostAffectedWorkflow = mostAffectedWorkflowId
      ? { id: mostAffectedWorkflowId[0], name: workflowMap.get(mostAffectedWorkflowId[0])?.name, count: mostAffectedWorkflowId[1] }
      : null;

    return reply.send({
      errors,
      summary: {
        total: errorCount,
        critical: criticalCount,
        warning: warningCount,
        mostAffectedWorkflow,
      },
    });
  });

  // Incident timeline combining executions, versions and audits
  app.get('/incident-timeline', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const { workflowId, hours = '24', limit = '120' } = request.query as {
      workflowId?: string;
      hours?: string;
      limit?: string;
    };

    const windowHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168);
    const maxItems = Math.min(Math.max(parseInt(limit, 10) || 120, 20), 400);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const workflowFilter = workflowId
      ? { id: workflowId, organizationId: request.organizationId! }
      : { organizationId: request.organizationId! };

    const workflows = await prisma.workflow.findMany({
      where: workflowFilter,
      select: {
        id: true,
        name: true,
        n8nInstance: { select: { name: true } },
      },
    });
    const workflowIds = workflows.map((w) => w.id);
    const workflowMap = new Map(workflows.map((w) => [w.id, w]));

    const [executions, versions, audits] = await Promise.all([
      prisma.workflowExecution.findMany({
        where: {
          workflowId: { in: workflowIds },
          status: 'error',
          startedAt: { gte: since },
        },
        include: {
          workflow: {
            select: { name: true, n8nInstance: { select: { name: true } } },
          },
        },
      }),
      prisma.workflowVersion.findMany({
        where: {
          organizationId: request.organizationId!,
          workflowId: { in: workflowIds },
          createdAt: { gte: since },
        },
        include: {
          workflow: { select: { name: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          organizationId: request.organizationId!,
          createdAt: { gte: since },
          ...(workflowId ? { entityId: workflowId } : {}),
          action: {
            in: [
              'workflow.snapshot',
              'workflow.rollback',
              'workflow.promoted',
              'workflow.imported',
              'workflow.variable.set',
              'workflow.variable.deleted',
              'settings.updated',
            ],
          },
        },
        include: {
          actor: { select: { email: true, name: true } },
        },
      }),
    ]);

    const events = [];

    for (const exec of executions) {
      const parsed = exec.errorMessage ? parseN8nError(exec.errorMessage) : null;
      events.push({
        id: `execution-${exec.id}`,
        type: 'execution_error' as const,
        workflowId: exec.workflowId,
        workflowName: exec.workflow?.name ?? workflowMap.get(exec.workflowId)?.name ?? null,
        instanceName: exec.workflow?.n8nInstance.name ?? workflowMap.get(exec.workflowId)?.n8nInstance.name ?? null,
        timestamp: exec.startedAt.toISOString(),
        title: `Execution ${exec.n8nExecutionId} failed`,
        description: parsed?.shortMessage ?? exec.errorMessage ?? '',
        severity: parsed ? getErrorSeverity(parsed.errorType) : 'warning',
        metadata: {
          executionId: exec.n8nExecutionId,
          errorType: parsed?.errorType,
          nodeName: parsed?.nodeName,
        },
      });
    }

    for (const version of versions) {
      events.push({
        id: `version-${version.id}`,
        type: 'deployment' as const,
        workflowId: version.workflowId,
        workflowName: version.workflow?.name ?? workflowMap.get(version.workflowId)?.name ?? null,
        instanceName: workflowMap.get(version.workflowId)?.n8nInstance.name ?? null,
        timestamp: version.createdAt.toISOString(),
        title: `Snapshot ${version.hash.substring(0, 8)}`,
        description: version.label ?? undefined,
        severity: 'info' as const,
        metadata: {
          versionId: version.id,
        },
      });
    }

    for (const audit of audits) {
      events.push({
        id: `audit-${audit.id}`,
        type: 'audit' as const,
        workflowId: workflowIds.includes(audit.entityId) ? audit.entityId : null,
        workflowName: workflowMap.get(audit.entityId)?.name ?? null,
        instanceName: workflowMap.get(audit.entityId)?.n8nInstance.name ?? null,
        timestamp: audit.createdAt.toISOString(),
        title: `Audit: ${audit.action}`,
        description: audit.metadata?.message as string | undefined,
        severity: 'info' as const,
        metadata: {
          action: audit.action,
          actor: audit.actor?.email ?? audit.actor?.name ?? 'system',
          metadata: audit.metadata,
        },
      });
    }

    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return reply.send({
      events: events.slice(0, maxItems),
      total: events.length,
      windowHours,
    });
  });

  // SLA metrics
  app.get('/monitoring/sla', {
    preHandler: [authMiddleware, orgMiddleware],
  }, async (request, reply) => {
    const {
      hours = '24',
      latencyMs = '5000',
      errorRate = '0.05',
      limit = '25',
    } = request.query as {
      hours?: string;
      latencyMs?: string;
      errorRate?: string;
      limit?: string;
    };

    const windowHours = Math.min(Math.max(parseInt(hours, 10) || 24, 1), 168);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const latencyThreshold = Math.max(parseInt(latencyMs, 10) || 5000, 100);
    const errorThreshold = Math.min(Math.max(parseFloat(errorRate) || 0.05, 0), 1);
    const workflowLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 5), 200);

    const executions = await prisma.workflowExecution.findMany({
      where: {
        workflow: { organizationId: request.organizationId! },
        startedAt: { gte: since },
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            n8nInstance: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totals = {
      executions: executions.length,
      errors: 0,
      avgDurationMs: 0,
    };

    const perWorkflowMap = new Map<
      string,
      {
        workflowId: string;
        workflowName: string;
        instanceId: string | null;
        instanceName: string | null;
        total: number;
        errors: number;
        durations: number[];
        totalDuration: number;
        lastExecutionAt: Date | null;
      }
    >();

    const perInstanceMap = new Map<
      string,
      {
        instanceId: string;
        instanceName: string;
        total: number;
        errors: number;
        totalDuration: number;
        durations: number[];
        workflowsTracked: Set<string>;
      }
    >();

    for (const exec of executions) {
      const workflowId = exec.workflow?.id;
      const instanceId = exec.workflow?.n8nInstance.id ?? null;
      const instanceName = exec.workflow?.n8nInstance.name ?? null;
      const workflowName = exec.workflow?.name ?? 'Unknown workflow';
      const duration = exec.durationMs ?? Math.max(
        0,
        (exec.stoppedAt?.getTime() ?? Date.now()) - exec.startedAt.getTime()
      );

      totals.errors += exec.status === 'error' ? 1 : 0;
      totals.avgDurationMs += duration;

      if (workflowId) {
        const wfStat =
          perWorkflowMap.get(workflowId) ??
          {
            workflowId,
            workflowName,
            instanceId,
            instanceName,
            total: 0,
            errors: 0,
            durations: [],
            totalDuration: 0,
            lastExecutionAt: null,
          };
        wfStat.total += 1;
        if (exec.status === 'error') wfStat.errors += 1;
        wfStat.durations.push(duration);
        wfStat.totalDuration += duration;
        if (!wfStat.lastExecutionAt || exec.startedAt > wfStat.lastExecutionAt) {
          wfStat.lastExecutionAt = exec.startedAt;
        }
        perWorkflowMap.set(workflowId, wfStat);
      }

      if (instanceId) {
        const instStat =
          perInstanceMap.get(instanceId) ??
          {
            instanceId,
            instanceName,
            total: 0,
            errors: 0,
            totalDuration: 0,
            durations: [],
            workflowsTracked: new Set<string>(),
          };
        instStat.total += 1;
        if (exec.status === 'error') instStat.errors += 1;
        instStat.totalDuration += duration;
        instStat.durations.push(duration);
        if (workflowId) instStat.workflowsTracked.add(workflowId);
        perInstanceMap.set(instanceId, instStat);
      }
    }

    totals.avgDurationMs =
      executions.length > 0 ? Math.round(totals.avgDurationMs / executions.length) : 0;

    const computePercentile = (values: number[], percentile: number) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
      return sorted[index];
    };

    const perWorkflow = Array.from(perWorkflowMap.values()).map((stat) => {
      const errorRateValue = stat.total > 0 ? stat.errors / stat.total : 0;
      const avgDuration = stat.total > 0 ? Math.round(stat.totalDuration / stat.total) : 0;
      const p95 = computePercentile(stat.durations, 95);
      return {
        workflowId: stat.workflowId,
        workflowName: stat.workflowName,
        instanceId: stat.instanceId,
        instanceName: stat.instanceName,
        totalExecutions: stat.total,
        errorRate: Number(errorRateValue.toFixed(3)),
        avgDurationMs: avgDuration,
        p95DurationMs: p95,
        lastExecutionAt: stat.lastExecutionAt?.toISOString() ?? null,
      };
    });

    const perInstance = Array.from(perInstanceMap.values()).map((stat) => {
      const avgDuration = stat.total > 0 ? Math.round(stat.totalDuration / stat.total) : 0;
      const errorRateValue = stat.total > 0 ? stat.errors / stat.total : 0;
      return {
        instanceId: stat.instanceId,
        instanceName: stat.instanceName,
        totalExecutions: stat.total,
        errorRate: Number(errorRateValue.toFixed(3)),
        avgDurationMs: avgDuration,
        workflowsTracked: stat.workflowsTracked.size,
      };
    });

    const breaches = perWorkflow
      .filter(
        (wf) =>
          wf.errorRate >= errorThreshold || wf.p95DurationMs >= latencyThreshold
      )
      .sort((a, b) => b.errorRate - a.errorRate || b.p95DurationMs - a.p95DurationMs)
      .slice(0, workflowLimit)
      .map((wf) => ({
        workflowId: wf.workflowId,
        workflowName: wf.workflowName,
        instanceName: wf.instanceName,
        errorRate: wf.errorRate,
        p95DurationMs: wf.p95DurationMs,
        avgDurationMs: wf.avgDurationMs,
        totalExecutions: wf.totalExecutions,
        reason:
          wf.errorRate >= errorThreshold && wf.p95DurationMs >= latencyThreshold
            ? 'error_rate_latency'
            : wf.errorRate >= errorThreshold
            ? 'error_rate'
            : 'latency',
      }));

    return reply.send({
      windowHours,
      thresholds: {
        latencyMs: latencyThreshold,
        errorRate: errorThreshold,
      },
      totals,
      perWorkflow,
      perInstance,
      breaches,
    });
  });
}
