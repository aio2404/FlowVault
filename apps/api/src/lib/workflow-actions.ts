import type {
  Workflow,
  N8nInstance,
  WorkflowQuarantineEvent,
} from '@prisma/client';
import { prisma } from './prisma.js';
import { decryptFromDb } from './encryption.js';
import { createN8nClient } from './n8n-client.js';
import { computeDeepHash } from './hash.js';
import { sendOrgNotification, buildWorkflowUrl } from './notifications.js';

type WorkflowWithInstance = Workflow & { n8nInstance: N8nInstance };

export type QuarantineAction =
  | 'pause'
  | 'rollback_full'
  | 'rollback_nodes'
  | 'variables_only';

export interface NormalizedQuarantineConfig {
  enabled: boolean;
  strategy: QuarantineAction;
  threshold: number;
  windowMinutes: number;
  versionId: string | null;
  nodeNames: string[];
  includeConnections: boolean;
  notify: boolean;
}

const DEFAULT_CONFIG: NormalizedQuarantineConfig = {
  enabled: false,
  strategy: 'pause',
  threshold: 3,
  windowMinutes: 15,
  versionId: null,
  nodeNames: [],
  includeConnections: true,
  notify: true,
};

export function normalizeQuarantineConfig(
  input: unknown
): NormalizedQuarantineConfig {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const value = input as Record<string, unknown>;

  const enabled =
    typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_CONFIG.enabled;
  const threshold =
    typeof value.threshold === 'number' && Number.isFinite(value.threshold)
      ? Math.max(1, Math.min(1000, Math.floor(value.threshold)))
      : DEFAULT_CONFIG.threshold;
  const windowMinutes =
    typeof value.windowMinutes === 'number' && Number.isFinite(value.windowMinutes)
      ? Math.max(1, Math.min(1440, Math.floor(value.windowMinutes)))
      : DEFAULT_CONFIG.windowMinutes;
  const strategy = ((): QuarantineAction => {
    const candidate = value.strategy;
    if (
      candidate === 'pause' ||
      candidate === 'rollback_full' ||
      candidate === 'rollback_nodes' ||
      candidate === 'variables_only'
    ) {
      return candidate;
    }
    return DEFAULT_CONFIG.strategy;
  })();
  const includeConnections =
    typeof value.includeConnections === 'boolean'
      ? value.includeConnections
      : DEFAULT_CONFIG.includeConnections;
  const notify =
    typeof value.notify === 'boolean' ? value.notify : DEFAULT_CONFIG.notify;

  const versionId =
    typeof value.versionId === 'string' && value.versionId.length > 0
      ? value.versionId
      : DEFAULT_CONFIG.versionId;

  const nodeNames = Array.isArray(value.nodeNames)
    ? Array.from(
        new Set(
          value.nodeNames
            .filter((node): node is string => typeof node === 'string')
            .map((node) => node.trim())
            .filter(Boolean)
        )
      )
    : DEFAULT_CONFIG.nodeNames;

  return {
    enabled,
    strategy,
    threshold,
    windowMinutes,
    versionId,
    nodeNames,
    includeConnections,
    notify,
  };
}

function cloneConnections(connections: Record<string, unknown> | undefined) {
  return JSON.parse(JSON.stringify(connections ?? {}));
}

function sanitizeWorkflowPayload(workflowJson: Record<string, any>) {
  return {
    name: workflowJson.name,
    nodes: workflowJson.nodes,
    connections: workflowJson.connections,
    settings: workflowJson.settings,
    staticData: workflowJson.staticData,
    tags: workflowJson.tags,
  };
}

async function getN8nClient(workflow: WorkflowWithInstance) {
  const apiKey = decryptFromDb(
    workflow.n8nInstance.apiKeyEncrypted,
    workflow.n8nInstance.apiKeyIv,
    workflow.n8nInstance.apiKeyTag
  );

  return createN8nClient({
    baseUrl: workflow.n8nInstance.baseUrl,
    apiKey,
  });
}

export interface PerformTargetedRestoreOptions {
  organizationId: string;
  workflow: WorkflowWithInstance;
  versionId: string;
  mode: 'full' | 'nodes' | 'variables' | 'singleNode';
  nodeNames?: string[];
  includeConnections?: boolean;
  actorUserId?: string | null;
  label?: string;
}

export interface PerformTargetedRestoreResult {
  mode: PerformTargetedRestoreOptions['mode'];
  newVersion: {
    id: string;
    hash: string;
    label: string | null;
    createdAt: string;
  };
  restoredNodes?: string[];
}

export async function performTargetedRestore(
  options: PerformTargetedRestoreOptions
): Promise<PerformTargetedRestoreResult> {
  const {
    organizationId,
    workflow,
    versionId,
    mode,
    nodeNames = [],
    includeConnections = true,
    actorUserId,
    label,
  } = options;

  const targetVersion = await prisma.workflowVersion.findFirst({
    where: {
      id: versionId,
      workflowId: workflow.id,
      organizationId,
    },
  });

  if (!targetVersion) {
    throw new Error('Version not found');
  }

  const targetContent = targetVersion.jsonContent as Record<string, any>;
  const client = await getN8nClient(workflow);
  const currentWorkflow = await client.getWorkflow(workflow.n8nWorkflowId);
  let updatedWorkflowContent = currentWorkflow;

  if (mode === 'variables') {
    const snapshot =
      (targetVersion.variablesSnapshot as Array<{
        key: string;
        value: string;
        isSecret: boolean;
        description?: string | null;
      }>) || [];

    if (!snapshot.length) {
      throw new Error('Cette version ne contient pas de snapshot de variables.');
    }

    await prisma.workflowVariable.deleteMany({
      where: { workflowId: workflow.id },
    });

    await prisma.workflowVariable.createMany({
      data: snapshot.map((v) => ({
        workflowId: workflow.id,
        key: v.key,
        value: v.value,
        isSecret: v.isSecret,
        description: v.description ?? null,
      })),
    });
  } else {
    const workingCopy = JSON.parse(JSON.stringify(currentWorkflow));
    const nodeNameSet = new Set(
      (nodeNames ?? []).map((n) => n.trim()).filter(Boolean)
    );

    if (mode === 'full') {
      workingCopy.nodes = targetContent.nodes ?? [];
      workingCopy.connections = targetContent.connections ?? {};
      workingCopy.settings = targetContent.settings ?? null;
      workingCopy.staticData = targetContent.staticData ?? null;
    } else if (mode === 'nodes') {
      workingCopy.nodes = targetContent.nodes ?? [];
      if (includeConnections) {
        workingCopy.connections = targetContent.connections ?? {};
      }
    } else if (mode === 'singleNode') {
      if (nodeNameSet.size === 0) {
        throw new Error('Spécifiez au moins un nœud à restaurer.');
      }

      const targetNodes =
        (targetContent.nodes as Array<{ name: string }>)?.filter((node) =>
          nodeNameSet.has(node.name)
        ) ?? [];

      if (!targetNodes.length) {
        throw new Error('Aucun nœud correspondant dans cette version.');
      }

      const currentNodes =
        (workingCopy.nodes as Array<{ name: string }>) ?? [];
      const keptNodes = currentNodes.filter(
        (node) => !nodeNameSet.has(node.name)
      );
      workingCopy.nodes = [...keptNodes, ...targetNodes];

      if (includeConnections) {
        const currentConnections = cloneConnections(workingCopy.connections);
        const targetConnections = targetContent.connections ?? {};

        Object.entries(targetConnections).forEach(([source, config]) => {
          if (!config || typeof config !== 'object') return;
          const typedConfig = config as {
            main?: Array<Array<{ node: string }>>;
          };
          if (nodeNameSet.has(source)) {
            currentConnections[source] = typedConfig;
            return;
          }
          const outputs = typedConfig.main;
          if (!outputs) return;
          if (!currentConnections[source]) {
            currentConnections[source] = { main: [] };
          }
          outputs.forEach((connList, outputIndex) => {
            if (!Array.isArray(connList)) return;
            connList.forEach((conn, connIndex) => {
              if (conn && nodeNameSet.has(conn.node)) {
                if (!currentConnections[source].main) {
                  currentConnections[source].main = [];
                }
                if (!currentConnections[source].main![outputIndex]) {
                  currentConnections[source].main![outputIndex] = [];
                }
                currentConnections[source].main![outputIndex]![connIndex] = conn;
              }
            });
          });
        });

        workingCopy.connections = currentConnections;
      }
    }

    await client.updateWorkflow(
      workflow.n8nWorkflowId,
      sanitizeWorkflowPayload(workingCopy)
    );

    updatedWorkflowContent = await client.getWorkflow(workflow.n8nWorkflowId);
  }

  const latestVariables = await prisma.workflowVariable.findMany({
    where: { workflowId: workflow.id },
  });

  const newHash = computeDeepHash(updatedWorkflowContent);
  const newVersionRecord = await prisma.workflowVersion.create({
    data: {
      organizationId,
      workflowId: workflow.id,
      hash: newHash,
      jsonContent: updatedWorkflowContent as object,
      variablesSnapshot: latestVariables.map((v) => ({
        key: v.key,
        value: v.value,
        isSecret: v.isSecret,
        description: v.description,
      })),
      label: label ?? `Targeted restore (${mode})`,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'workflow.targeted_restore',
      entityType: 'workflow',
      entityId: workflow.id,
      metadata: {
        mode,
        versionId,
        nodeNames: nodeNames.length ? nodeNames : undefined,
      },
    },
  });

  return {
    mode,
    newVersion: {
      id: newVersionRecord.id,
      hash: newVersionRecord.hash.substring(0, 8),
      label: newVersionRecord.label,
      createdAt: newVersionRecord.createdAt.toISOString(),
    },
    restoredNodes: nodeNames.length ? nodeNames : undefined,
  };
}

export interface QuarantineWorkflowOptions {
  workflow: WorkflowWithInstance;
  organizationId: string;
  action: QuarantineAction;
  reason: string;
  actorUserId?: string | null;
  versionId?: string | null;
  nodeNames?: string[];
  includeConnections?: boolean;
  trigger?: 'manual' | 'auto';
  notify?: boolean;
  metadata?: Record<string, unknown>;
}

export async function quarantineWorkflow(
  options: QuarantineWorkflowOptions
): Promise<{
  workflow: Workflow;
  event: WorkflowQuarantineEvent;
  rollbackResult?: PerformTargetedRestoreResult | null;
}> {
  const {
    workflow,
    organizationId,
    action,
    reason,
    actorUserId,
    versionId,
    nodeNames = [],
    includeConnections = true,
    trigger = 'manual',
    notify = true,
    metadata,
  } = options;

  let rollbackResult: PerformTargetedRestoreResult | null = null;
  const needsRollback = action !== 'pause';
  let resolvedVersionId = versionId ?? null;

  if (needsRollback && !resolvedVersionId) {
    const latestVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflow.id, organizationId },
      orderBy: { createdAt: 'desc' },
    });
    resolvedVersionId = latestVersion?.id ?? null;
  }

  if (needsRollback && !resolvedVersionId) {
    console.warn(
      `[Quarantine] No version available for workflow ${workflow.id}, falling back to pause strategy.`
    );
  }

  if (needsRollback && resolvedVersionId) {
    const mode: PerformTargetedRestoreOptions['mode'] =
      action === 'rollback_full'
        ? 'full'
        : action === 'rollback_nodes'
        ? nodeNames.length
          ? 'singleNode'
          : 'nodes'
        : 'variables';

    try {
      rollbackResult = await performTargetedRestore({
        organizationId,
        workflow,
        versionId: resolvedVersionId,
        mode,
        nodeNames,
        includeConnections,
        actorUserId,
        label: `Auto-restore (${trigger})`,
      });
    } catch (error) {
      console.error(
        `[Quarantine] Failed to rollback workflow ${workflow.id}:`,
        error
      );
      rollbackResult = null;
    }
  }

  try {
    const client = await getN8nClient(workflow);
    await client.deactivateWorkflow(workflow.n8nWorkflowId);
  } catch (error) {
    console.error(
      `[Quarantine] Failed to deactivate workflow ${workflow.id} inside n8n:`,
      error
    );
  }

  const updatedWorkflow = await prisma.workflow.update({
    where: { id: workflow.id },
    data: {
      status: 'quarantined',
      quarantineReason: reason,
      quarantineSince: new Date(),
    },
  });

  const event = await prisma.workflowQuarantineEvent.create({
    data: {
      organizationId,
      workflowId: workflow.id,
      action: trigger === 'auto' ? 'auto_quarantine' : action,
      reason,
      metadata: {
        ...metadata,
        strategy: action,
        rollbackResult: rollbackResult ?? undefined,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorUserId: actorUserId ?? null,
      action:
        trigger === 'auto'
          ? 'workflow.quarantine.auto'
          : 'workflow.quarantine.manual',
      entityType: 'workflow',
      entityId: workflow.id,
      metadata: {
        action,
        trigger,
        reason,
        nodeNames: nodeNames.length ? nodeNames : undefined,
      },
    },
  });

  if (notify) {
    await sendOrgNotification(organizationId, {
      title: `Workflow mis en quarantaine • ${workflow.name}`,
      body: `${reason}. L'exécution a été suspendue sur ${workflow.n8nInstance.name}.`,
      url: buildWorkflowUrl(workflow.id),
    });
  }

  return {
    workflow: updatedWorkflow,
    event,
    rollbackResult,
  };
}

async function fetchWorkflowForAutoRemediation(
  workflowId: string,
  organizationId: string
) {
  return prisma.workflow.findFirst({
    where: { id: workflowId, organizationId },
    include: {
      n8nInstance: true,
    },
  });
}

export async function maybeTriggerAutoQuarantine(options: {
  workflowId: string;
  organizationId: string;
  recentErrorMessage?: string | null;
}) {
  const { workflowId, organizationId, recentErrorMessage } = options;
  const workflow = await fetchWorkflowForAutoRemediation(
    workflowId,
    organizationId
  );

  if (!workflow) {
    return { triggered: false };
  }

  if (workflow.status === 'quarantined') {
    return { triggered: false };
  }

  const config = normalizeQuarantineConfig(workflow.quarantineConfig);
  if (!config.enabled) {
    return { triggered: false };
  }

  const windowStart = new Date(
    Date.now() - config.windowMinutes * 60 * 1000
  );
  const errorCount = await prisma.workflowExecution.count({
    where: {
      workflowId,
      status: 'error',
      startedAt: { gte: windowStart },
    },
  });

  if (errorCount < config.threshold) {
    return { triggered: false };
  }

  const reason = `Auto-quarantaine: ${errorCount} erreurs sur ${config.threshold} sur ${config.windowMinutes} min`;

  await quarantineWorkflow({
    workflow,
    organizationId,
    action: config.strategy,
    reason,
    versionId: config.versionId,
    nodeNames: config.nodeNames,
    includeConnections: config.includeConnections,
    actorUserId: null,
    trigger: 'auto',
    notify: config.notify,
    metadata: {
      errorCount,
      windowMinutes: config.windowMinutes,
      lastError: recentErrorMessage,
    },
  });

  return { triggered: true, reason };
}
