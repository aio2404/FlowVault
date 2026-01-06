const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  organizationId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, organizationId } = options;

  const headers: Record<string, string> = {};

  // Only set Content-Type if we have a body or it's a POST/PUT/PATCH request
  if (body !== undefined || ['POST', 'PUT', 'PATCH'].includes(method)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (organizationId) {
    headers['X-Organization-Id'] = organizationId;
  }

  // For POST/PUT/PATCH without body, send empty object
  const requestBody = body !== undefined 
    ? JSON.stringify(body) 
    : ['POST', 'PUT', 'PATCH'].includes(method) 
      ? '{}' 
      : undefined;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: requestBody,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      (data as { message?: string })?.message ||
      (data as { error?: string })?.error ||
      'Request failed';
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

// Auth endpoints
export const authApi = {
  requestMagicLink: (email: string) =>
    api<{ success: boolean; message: string }>('/auth/magic-link', {
      method: 'POST',
      body: { email },
    }),

  startSso: (email: string) =>
    api<{
      provider: string;
      organizationId: string;
      redirectUrl: string | null;
      nonce: string;
      expiresAt: string;
      callbackUrl: string;
    }>('/auth/sso/start', {
      method: 'POST',
      body: { email },
    }),

  verifyToken: (token: string) =>
    api<{ user: { id: string; email: string; name: string | null }; token: string; expiresAt: string }>(
      '/auth/verify',
      { method: 'POST', body: { token } }
    ),

  getMe: (token: string) =>
    api<{
      user: { id: string; email: string; name: string | null };
      organizations: Array<{ id: string; name: string; role: string }>;
    }>('/auth/me', { token }),

  logout: (token: string) =>
    api<{ success: boolean }>('/auth/logout', { method: 'POST', token }),

  updateProfile: (token: string, name: string) =>
    api<{ user: { id: string; email: string; name: string | null } }>(
      '/auth/profile',
      { method: 'PATCH', token, body: { name } }
    ),
};

// Organization endpoints
export const orgApi = {
  create: (token: string, name: string) =>
    api<{ id: string; name: string; createdAt: string }>('/organizations', {
      method: 'POST',
      token,
      body: { name },
    }),

  get: (token: string, id: string) =>
    api<{ id: string; name: string; role: string; createdAt: string }>(
      `/organizations/${id}`,
      { token }
    ),

  update: (token: string, id: string, name: string) =>
    api<{ id: string; name: string; createdAt: string }>(
      `/organizations/${id}`,
      { method: 'PATCH', token, body: { name } }
    ),

  listMembers: (token: string, id: string) =>
    api<{
      members: Array<{
        id: string;
        userId: string;
        email: string;
        name: string | null;
        role: string;
        joinedAt: string;
      }>;
    }>(`/organizations/${id}/members`, { token }),
};

// Environment types
export type Environment = 'production' | 'staging' | 'development' | 'testing' | 'custom';

export const ENVIRONMENT_CONFIG: Record<Environment, { label: string; color: string; bgColor: string }> = {
  production: { label: 'Production', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/30' },
  staging: { label: 'Staging', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10 border-yellow-500/30' },
  development: { label: 'Development', color: 'text-blue-500', bgColor: 'bg-blue-500/10 border-blue-500/30' },
  testing: { label: 'Testing', color: 'text-purple-500', bgColor: 'bg-purple-500/10 border-purple-500/30' },
  custom: { label: 'Custom', color: 'text-gray-500', bgColor: 'bg-gray-500/10 border-gray-500/30' },
};

export interface PlanSummary {
  id: string;
  name: string;
  price: number;
  currency: string;
  instanceLimit: number;
  workflowLimit: number;
  description: string;
  features: string[];
  renewsAt?: string | null;
}

// Instance endpoints
export const instanceApi = {
  list: (token: string, organizationId: string) =>
    api<{
      instances: Array<{
        id: string;
        name: string;
        baseUrl: string;
        status: string;
        lastSeenAt: string | null;
        webhookEnabled: boolean;
        webhookUrl: string | null;
        environment: Environment;
        envColor: string | null;
        createdAt: string;
      }>;
      plan?: PlanSummary;
      usage?: { instances: number; workflows: number };
      limits?: { instances: number; workflows: number };
    }>('/instances', { token, organizationId }),

  get: (token: string, organizationId: string, id: string) =>
    api<{
      id: string;
      name: string;
      baseUrl: string;
      status: string;
      lastSeenAt: string | null;
      createdAt: string;
    }>(`/instances/${id}`, { token, organizationId }),

  create: (
    token: string,
    organizationId: string,
    data: { name: string; baseUrl: string; apiKey: string; environment?: Environment; envColor?: string }
  ) =>
    api<{
      id: string;
      name: string;
      baseUrl: string;
      status: string;
      environment: Environment;
      createdAt: string;
    }>('/instances', { method: 'POST', token, organizationId, body: data }),

  update: (
    token: string,
    organizationId: string,
    id: string,
    data: { name?: string; baseUrl?: string; apiKey?: string; environment?: Environment; envColor?: string | null }
  ) =>
    api<{
      id: string;
      name: string;
      baseUrl: string;
      status: string;
      lastSeenAt: string | null;
      environment: Environment;
      createdAt: string;
    }>(`/instances/${id}`, { method: 'PATCH', token, organizationId, body: data }),

  delete: (token: string, organizationId: string, id: string) =>
    api<{ success: boolean }>(`/instances/${id}`, {
      method: 'DELETE',
      token,
      organizationId,
    }),

  test: (token: string, organizationId: string, id: string) =>
    api<{ success: boolean; status: string; error?: string }>(
      `/instances/${id}/test`,
      { method: 'POST', token, organizationId }
    ),

  import: (token: string, organizationId: string, id: string) =>
    api<{ success: boolean; imported: number; updated: number; total: number }>(
      `/instances/${id}/import`,
      { method: 'POST', token, organizationId }
    ),

  // Webhook management
  enableWebhook: (token: string, organizationId: string, id: string) =>
    api<{ success: boolean; webhookUrl: string; message: string }>(
      `/instances/${id}/webhook/enable`,
      { method: 'POST', token, organizationId }
    ),

  disableWebhook: (token: string, organizationId: string, id: string) =>
    api<{ success: boolean; message: string }>(
      `/instances/${id}/webhook/disable`,
      { method: 'POST', token, organizationId }
    ),
};

export const billingApi = {
  getPlan: (token: string, organizationId: string) =>
    api<{
      plan: PlanSummary & { renewsAt: string | null };
      usage: { instances: number; workflows: number };
      limits: { instances: number; workflows: number };
      availablePlans: PlanSummary[];
    }>('/billing/plan', { token, organizationId }),

  changePlan: (token: string, organizationId: string, planId: string) =>
    api<{
      success: boolean;
      plan: PlanSummary & { renewsAt: string | null };
      usage: { instances: number; workflows: number };
      limits: { instances: number; workflows: number };
    }>('/billing/change-plan', {
      method: 'POST',
      token,
      organizationId,
      body: { planId },
    }),

  usage: (token: string, organizationId: string) =>
    api<{
      plan: PlanSummary & { renewsAt: string | null };
      usage: { instances: number; workflows: number };
      limits: { instances: number; workflows: number };
      estimatedMonthlyCost: { amount: number; currency: string };
      costHistory: Array<{
        month: string;
        amount: number;
        currency: string;
        instances: number;
        workflows: number;
      }>;
      instanceUsage: Array<{
        id: string;
        name: string;
        baseUrl: string;
        environment: string;
        workflowCount: number;
        createdAt: string;
        lastSeenAt: string | null;
      }>;
      workflowUsage: Array<{
        id: string;
        name: string;
        instanceName: string;
        versionCount: number;
        executionCount: number;
        lastSnapshotAt: string | null;
        updatedAt: string;
      }>;
    }>('/billing/usage', { token, organizationId }),

  downloadUsageCsv: async (token: string, organizationId: string) => {
    const response = await fetch(
      `${API_URL}/billing/usage.csv`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organizationId,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download CSV');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usage.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

// Workflow endpoints
export const workflowApi = {
  list: (
    token: string,
    organizationId: string,
    params?: { instanceId?: string; search?: string; environment?: Environment }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.instanceId) searchParams.set('instanceId', params.instanceId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.environment) searchParams.set('environment', params.environment);
    const query = searchParams.toString();
    return api<{
      workflows: Array<{
        id: string;
        name: string;
        n8nWorkflowId: string;
        instanceId: string;
        instanceName: string;
        environment: Environment;
        active: boolean;
        lastSnapshot: string | null;
        status: 'active' | 'quarantined';
        quarantineReason: string | null;
        quarantineSince: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/workflows${query ? `?${query}` : ''}`, { token, organizationId });
  },

  get: (token: string, organizationId: string, id: string) =>
    api<{
      id: string;
      name: string;
      n8nWorkflowId: string;
      instanceId: string;
      instanceName: string;
      environment: string;
      promotedFrom: string | null;
      promotedAt: string | null;
      active: boolean;
      versionCount: number;
      status: 'active' | 'quarantined';
      quarantineSince: string | null;
      quarantineReason: string | null;
      quarantineConfig: {
        enabled: boolean;
        strategy: 'pause' | 'rollback_full' | 'rollback_nodes' | 'variables_only';
        threshold: number;
        windowMinutes: number;
        versionId: string | null;
        nodeNames: string[];
        includeConnections: boolean;
        notify: boolean;
      };
      quarantineTimeline: Array<{
        id: string;
        action: string;
        reason: string | null;
        metadata?: Record<string, unknown> | null;
        createdAt: string;
      }>;
      variables: Array<{
        id: string;
        key: string;
        value: string;
        isSecret: boolean;
        description: string | null;
      }>;
      createdAt: string;
      updatedAt: string;
    }>(`/workflows/${id}`, { token, organizationId }),

  update: (
    token: string,
    organizationId: string,
    id: string,
    data: {
      environment?: string;
      status?: 'active' | 'quarantined';
      quarantineConfig?: Partial<{
        enabled: boolean;
        strategy: 'pause' | 'rollback_full' | 'rollback_nodes' | 'variables_only';
        threshold: number;
        windowMinutes: number;
        versionId?: string | null;
        nodeNames?: string[];
        includeConnections?: boolean;
        notify?: boolean;
      }>;
    }
  ) =>
    api<{ success: boolean; workflow: { id: string; environment: string } }>(
      `/workflows/${id}`,
      { method: 'PATCH', token, organizationId, body: data }
    ),

  listVersions: (
    token: string,
    organizationId: string,
    id: string,
    params?: { limit?: number; offset?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return api<{
      versions: Array<{
        id: string;
        hash: string;
        label: string | null;
        versionNumber: number;
        createdAt: string;
      }>;
      total: number;
    }>(`/workflows/${id}/versions${query ? `?${query}` : ''}`, {
      token,
      organizationId,
    });
  },

  getVersion: (
    token: string,
    organizationId: string,
    workflowId: string,
    versionId: string
  ) =>
    api<{
      id: string;
      hash: string;
      label: string | null;
      jsonContent: Record<string, unknown>;
      createdAt: string;
    }>(`/workflows/${workflowId}/versions/${versionId}`, {
      token,
      organizationId,
    }),

  getDiff: (
    token: string,
    organizationId: string,
    workflowId: string,
    from: string,
    to: string
  ) =>
    api<{
      from: { id: string; hash: string; label: string | null; createdAt: string };
      to: { id: string; hash: string; label: string | null; createdAt: string };
      summary: {
        nodesAdded: number;
        nodesRemoved: number;
        nodesChanged: number;
        connectionsChanged: boolean;
        settingsChanged: boolean;
      };
      nodeChanges: Array<{
        type: 'added' | 'removed' | 'changed';
        nodeName: string;
        nodeType: string;
        details?: string[];
      }>;
      connectionChanges: Array<{
        type: 'added' | 'removed';
        source: string;
        target: string;
        outputIndex?: number;
        targetIndex?: number;
        connectionType?: string;
        edgeId?: string;
      }>;
      fromJson: Record<string, unknown>;
      toJson: Record<string, unknown>;
    }>(`/workflows/${workflowId}/diff?from=${from}&to=${to}`, {
      token,
      organizationId,
    }),

  snapshot: (
    token: string,
    organizationId: string,
    id: string,
    label?: string
  ) =>
    api<{
      success: boolean;
      created: boolean;
      message?: string;
      version?: {
        id: string;
        hash: string;
        label: string | null;
        createdAt: string;
      };
    }>(`/workflows/${id}/snapshot`, {
      method: 'POST',
      token,
      organizationId,
      body: { label },
    }),

  rollback: (
    token: string,
    organizationId: string,
    workflowId: string,
    versionId: string
  ) =>
    api<{
      success: boolean;
      newVersion?: {
        id: string;
        hash: string;
        label: string | null;
        createdAt: string;
      };
      error?: string;
    }>(`/workflows/${workflowId}/rollback`, {
      method: 'POST',
      token,
      organizationId,
      body: { versionId, confirm: true },
    }),

  targetedRestore: (
    token: string,
    organizationId: string,
    workflowId: string,
    data: { versionId: string; mode: 'full' | 'nodes' | 'variables' | 'singleNode'; nodeNames?: string[]; includeConnections?: boolean }
  ) =>
    api<{
      success: boolean;
      mode: string;
      newVersion?: {
        id: string;
        hash: string;
        label: string | null;
        createdAt: string;
      };
    }>(`/workflows/${workflowId}/restore`, {
      method: 'POST',
      token,
      organizationId,
      body: data,
    }),

  quarantine: (
    token: string,
    organizationId: string,
    workflowId: string,
    payload: {
      action: 'pause' | 'rollback_full' | 'rollback_nodes' | 'variables_only';
      reason?: string;
      versionId?: string;
      nodes?: string[];
    }
  ) =>
    api<{ success: boolean; status: string }>(`/workflows/${workflowId}/quarantine`, {
      method: 'POST',
      token,
      organizationId,
      body: payload,
    }),

  release: (token: string, organizationId: string, workflowId: string) =>
    api<{ success: boolean }>(`/workflows/${workflowId}/release`, {
      method: 'POST',
      token,
      organizationId,
    }),

  getExecutions: (
    token: string,
    organizationId: string,
    workflowId: string,
    params?: { limit?: number; refresh?: boolean }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.refresh) searchParams.set('refresh', 'true');
    const query = searchParams.toString();
    return api<{
      executions: Array<{
        id: string;
        n8nExecutionId: string;
        status: string;
        mode: string;
        startedAt: string;
        stoppedAt: string | null;
        durationMs: number | null;
        errorMessage: string | null;
      }>;
    }>(`/workflows/${workflowId}/executions${query ? `?${query}` : ''}`, {
      token,
      organizationId,
    });
  },

  syncExecutions: (
    token: string,
    organizationId: string,
    workflowId: string
  ) =>
    api<{ success: boolean; synced: number; error?: string }>(
      `/workflows/${workflowId}/executions/sync`,
      {
        method: 'POST',
        token,
        organizationId,
      }
    ),

  getErrors: (
    token: string,
    organizationId: string,
    workflowId: string,
    params?: { limit?: number; errorType?: string }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.errorType) searchParams.set('errorType', params.errorType);
    const query = searchParams.toString();
    return api<{
      errors: Array<{
        id: string;
        executionId: string;
        startedAt: string;
        nodeName: string | null;
        nodeType: string | null;
        errorType: string;
        shortMessage: string;
        fullMessage: string;
        suggestion: string | null;
        severity: 'critical' | 'warning' | 'info';
      }>;
      summary: {
        total: number;
        byType: Record<string, number>;
        mostProblematicNode: { name: string; count: number } | null;
      };
    }>(`/workflows/${workflowId}/errors${query ? `?${query}` : ''}`, {
      token,
      organizationId,
    });
  },

  // Variables management
  getVariables: (token: string, organizationId: string, workflowId: string) =>
    api<{
      variables: Array<{
        id: string;
        key: string;
        value: string;
        isSecret: boolean;
        description: string | null;
      }>;
    }>(`/workflows/${workflowId}/variables`, { token, organizationId }),

  setVariable: (
    token: string,
    organizationId: string,
    workflowId: string,
    data: { key: string; value: string; isSecret?: boolean; description?: string }
  ) =>
    api<{
      success: boolean;
      variable: {
        id: string;
        key: string;
        value: string;
        isSecret: boolean;
        description: string | null;
      };
    }>(`/workflows/${workflowId}/variables`, {
      method: 'POST',
      token,
      organizationId,
      body: data,
    }),

  deleteVariable: (
    token: string,
    organizationId: string,
    workflowId: string,
    variableId: string
  ) =>
    api<{ success: boolean }>(
      `/workflows/${workflowId}/variables/${variableId}`,
      { method: 'DELETE', token, organizationId }
    ),

  // Promotion
  promote: (
    token: string,
    organizationId: string,
    workflowId: string,
    data: { targetEnvironment: string; targetInstanceId?: string; copyVariables?: boolean }
  ) =>
    api<{
      success: boolean;
      promotedWorkflow: {
        id: string;
        name: string;
        environment: string;
        instanceName: string;
      };
    }>(`/workflows/${workflowId}/promote`, {
      method: 'POST',
      token,
      organizationId,
      body: data,
    }),

  createPromotionRequest: (
    token: string,
    organizationId: string,
    workflowId: string,
    data: {
      targetEnvironment: string;
      targetInstanceId?: string;
      copyVariables?: boolean;
      checklist?: Array<{ key: string; label: string; status?: 'pending' | 'pass' | 'fail'; required?: boolean }>;
      notes?: string;
    }
  ) =>
    api<{
      promotionRequest: PromotionRequest;
    }>(`/workflows/${workflowId}/promotion-requests`, {
      method: 'POST',
      token,
      organizationId,
      body: data,
    }),

  listPromotionRequests: (
    token: string,
    organizationId: string,
    workflowId: string
  ) =>
    api<{
      promotionRequests: PromotionRequest[];
    }>(`/workflows/${workflowId}/promotion-requests`, {
      token,
      organizationId,
    }),

  updatePromotionChecklist: (
    token: string,
    organizationId: string,
    requestId: string,
    data: { checks: Array<{ key: string; status: 'pending' | 'pass' | 'fail'; notes?: string }> }
  ) =>
    api<{ success: boolean; checklist: PromotionRequest['checklist'] }>(
      `/promotion-requests/${requestId}/checklist`,
      {
        method: 'PATCH',
        token,
        organizationId,
        body: data,
      }
    ),

  updatePromotionStatus: (
    token: string,
    organizationId: string,
    requestId: string,
    status: 'ready_for_review' | 'approved' | 'rejected',
    notes?: string
  ) =>
    api<{ promotionRequest: PromotionRequest }>(
      `/promotion-requests/${requestId}/status`,
      {
        method: 'POST',
        token,
        organizationId,
        body: { status, notes },
      }
    ),
};

export interface PromotionRequest {
  id: string;
  workflowId: string;
  status: 'draft' | 'ready_for_review' | 'approved' | 'rejected';
  targetEnvironment: string;
  targetInstanceId: string | null;
  checklist: Array<{ key: string; label: string; status: 'pending' | 'pass' | 'fail'; required: boolean; notes?: string }>;
  notes?: string | null;
  sourceVersionId?: string | null;
  createdById: string;
  reviewerId?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  deployedAt?: string | null;
}

// Settings endpoints
export const settingsApi = {
  get: (token: string, organizationId: string) =>
    api<{
      organizationName: string;
      hasSlackWebhook: boolean;
      hasTeamsWebhook: boolean;
      hasCustomWebhook: boolean;
      alertEmails: string[];
      ssoConfig: {
        enabled: boolean;
        provider: string;
        domainHint: string | null;
        issuerUrl: string | null;
        loginUrl: string | null;
        audience: string | null;
        defaultRole: string;
        enforceForAll: boolean;
        hasSharedSecret: boolean;
        updatedAt: string | null;
      } | null;
    }>('/settings', {
      token,
      organizationId,
    }),

  update: (
    token: string,
    organizationId: string,
    data: {
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
    }
  ) =>
    api<{ success: boolean }>('/settings', {
      method: 'PATCH',
      token,
      organizationId,
      body: data,
    }),

  testNotifications: (token: string, organizationId: string) =>
    api<{ success: boolean; error?: string }>('/settings/test-notifications', {
      method: 'POST',
      token,
      organizationId,
    }),

  getAuditLogs: (
    token: string,
    organizationId: string,
    params?: { limit?: number; offset?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return api<{
      logs: Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string;
        metadata: Record<string, unknown>;
        actor: { id: string; email: string; name: string | null } | null;
        createdAt: string;
      }>;
    }>(`/audit-logs${query ? `?${query}` : ''}`, { token, organizationId });
  },

  getGlobalErrors: (
    token: string,
    organizationId: string,
    params?: { limit?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api<{
      errors: Array<{
        id: string;
        workflowId: string;
        workflowName: string;
        instanceName: string;
        executionId: string;
        startedAt: string;
        nodeName: string | null;
        errorType: string;
        shortMessage: string;
        suggestion: string | null;
        severity: 'critical' | 'warning' | 'info';
      }>;
      summary: {
        total: number;
        critical: number;
        warning: number;
        mostAffectedWorkflow: { id: string; name: string; count: number } | null;
      };
    }>(`/errors${query ? `?${query}` : ''}`, { token, organizationId });
  },

  syncAllExecutions: (token: string, organizationId: string) =>
    api<{
      success: boolean;
      totalSynced: number;
      totalErrors: number;
      results: Array<{ instanceName: string; synced: number; errors: number }>;
    }>('/sync-all-executions', {
      method: 'POST',
      token,
      organizationId,
    }),

  testSso: (token: string, organizationId: string, data?: { email?: string; externalId?: string }) =>
    api<{
      payload: { email: string; externalId: string; timestamp: string; nonce: string };
      signature: string;
      callbackUrl: string;
      instructions: string;
    }>('/settings/sso/test', {
      method: 'POST',
      token,
      organizationId,
      body: data || {},
    }),

  getIncidentTimeline: (
    token: string,
    organizationId: string,
    params?: { workflowId?: string; hours?: number; limit?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.workflowId) searchParams.set('workflowId', params.workflowId);
    if (params?.hours) searchParams.set('hours', String(params.hours));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api<{
      events: Array<{
        id: string;
        type: 'execution_error' | 'deployment' | 'audit';
        workflowId: string | null;
        workflowName: string | null;
        instanceName: string | null;
        timestamp: string;
        title: string;
        description?: string;
        severity?: 'critical' | 'warning' | 'info';
        metadata?: Record<string, unknown>;
      }>;
      total: number;
      windowHours: number;
    }>(`/incident-timeline${query ? `?${query}` : ''}`, {
      token,
      organizationId,
    });
  },

  getSlaMetrics: (
    token: string,
    organizationId: string,
    params?: { hours?: number; latencyMs?: number; errorRate?: number }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.hours) searchParams.set('hours', String(params.hours));
    if (params?.latencyMs) searchParams.set('latencyMs', String(params.latencyMs));
    if (params?.errorRate) searchParams.set('errorRate', String(params.errorRate));
    const query = searchParams.toString();
    return api<{
      windowHours: number;
      thresholds: { latencyMs: number; errorRate: number };
      totals: { executions: number; errors: number; avgDurationMs: number };
      perWorkflow: Array<{
        workflowId: string;
        workflowName: string;
        instanceId: string | null;
        instanceName: string | null;
        totalExecutions: number;
        errorRate: number;
        avgDurationMs: number;
        p95DurationMs: number;
        lastExecutionAt: string | null;
      }>;
      perInstance: Array<{
        instanceId: string;
        instanceName: string | null;
        totalExecutions: number;
        errorRate: number;
        avgDurationMs: number;
        workflowsTracked: number;
      }>;
      breaches: Array<{
        workflowId: string;
        workflowName: string;
        instanceName: string | null;
        errorRate: number;
        p95DurationMs: number;
        avgDurationMs: number;
        totalExecutions: number;
        reason: 'error_rate' | 'latency' | 'error_rate_latency';
      }>;
    }>(`/monitoring/sla${query ? `?${query}` : ''}`, { token, organizationId });
  },
};
