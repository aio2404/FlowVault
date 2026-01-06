/**
 * n8n Platform Adapter
 * Implements IAutomationPlatform for n8n instances
 */

import {
  IAutomationPlatform,
  PlatformType,
  PlatformCapabilities,
  PlatformWorkflow,
  PlatformWorkflowListItem,
  PlatformExecution,
  PlatformExecutionError,
  PlatformApiError,
  PlatformConfig,
} from './types.js';

interface N8nWorkflowRaw {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  nodes?: unknown[];
  connections?: unknown;
  settings?: unknown;
  staticData?: unknown;
  tags?: Array<{ id: string; name: string }>;
}

interface N8nExecutionRaw {
  id: string;
  finished: boolean;
  mode: string;
  retryOf: string | null;
  retrySuccessId: string | null;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  workflowName?: string;
  status: string;
  data?: {
    resultData?: {
      error?: {
        message: string;
        stack?: string;
        name?: string;
        node?: {
          name: string;
          type: string;
        };
      };
      lastNodeExecuted?: string;
    };
  };
}

export class N8nAdapter implements IAutomationPlatform {
  readonly type: PlatformType = 'n8n';
  readonly name = 'n8n';
  
  readonly capabilities: PlatformCapabilities = {
    canListWorkflows: true,
    canGetWorkflow: true,
    canUpdateWorkflow: true,
    canCreateWorkflow: true,
    canDeleteWorkflow: true,
    canListExecutions: true,
    canGetExecution: true,
    canGetExecutionErrors: true,
    canActivateWorkflow: true,
    canDeactivateWorkflow: true,
    supportsWebhooks: true,
    supportsVersioning: false, // n8n doesn't have native versioning
  };

  private baseUrl: string;
  private apiKey: string;

  constructor(config: PlatformConfig) {
    if (config.type !== 'n8n') {
      throw new Error('N8nAdapter requires config.type to be "n8n"');
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }

      throw new PlatformApiError(
        `n8n API request failed: ${response.statusText}`,
        'n8n',
        response.status,
        responseBody
      );
    }

    return response.json() as Promise<T>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.listWorkflows();
      return true;
    } catch (error) {
      if (error instanceof PlatformApiError) {
        throw error;
      }
      throw new PlatformApiError('Failed to connect to n8n', 'n8n', 0, error);
    }
  }

  async listWorkflows(): Promise<PlatformWorkflowListItem[]> {
    const response = await this.request<{ data: N8nWorkflowRaw[] }>(
      'GET',
      '/workflows'
    );
    return response.data.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }

  async getWorkflow(id: string): Promise<PlatformWorkflow> {
    const raw = await this.request<N8nWorkflowRaw>('GET', `/workflows/${id}`);
    return this.normalizeWorkflow(raw);
  }

  async updateWorkflow(
    id: string,
    data: Partial<PlatformWorkflow>
  ): Promise<PlatformWorkflow> {
    // Convert back to n8n format
    const payload: Record<string, unknown> = {};
    
    if (data.name) payload.name = data.name;
    if (data.rawData) {
      // Spread raw data but exclude read-only fields
      const { id: _, active: __, createdAt: ___, updatedAt: ____, ...rest } = data.rawData;
      Object.assign(payload, rest);
    }

    const raw = await this.request<N8nWorkflowRaw>('PUT', `/workflows/${id}`, payload);
    return this.normalizeWorkflow(raw);
  }

  async createWorkflow(data: Partial<PlatformWorkflow>): Promise<PlatformWorkflow> {
    const payload = {
      name: data.name || 'New Workflow',
      nodes: (data.rawData?.nodes as unknown[]) || [],
      connections: data.rawData?.connections || {},
      settings: data.rawData?.settings || {},
    };

    const raw = await this.request<N8nWorkflowRaw>('POST', '/workflows', payload);
    return this.normalizeWorkflow(raw);
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await this.request('DELETE', `/workflows/${id}`);
    return true;
  }

  async activateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/workflows/${id}/activate`);
    return true;
  }

  async deactivateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/workflows/${id}/deactivate`);
    return true;
  }

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
  }): Promise<PlatformExecution[]> {
    const searchParams = new URLSearchParams();
    if (params?.workflowId) searchParams.set('workflowId', params.workflowId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    searchParams.set('includeData', 'true');

    const query = searchParams.toString();
    const response = await this.request<{ data: N8nExecutionRaw[] }>(
      'GET',
      `/executions${query ? `?${query}` : ''}`
    );
    return response.data.map((e) => this.normalizeExecution(e));
  }

  async getExecution(id: string): Promise<PlatformExecution> {
    const raw = await this.request<N8nExecutionRaw>(
      'GET',
      `/executions/${id}?includeData=true`
    );
    return this.normalizeExecution(raw);
  }

  normalizeWorkflow(raw: unknown): PlatformWorkflow {
    const w = raw as N8nWorkflowRaw;
    return {
      id: w.id,
      name: w.name,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      rawData: w as Record<string, unknown>,
    };
  }

  normalizeExecution(raw: unknown): PlatformExecution {
    const e = raw as N8nExecutionRaw;
    const startedAt = new Date(e.startedAt);
    const stoppedAt = e.stoppedAt ? new Date(e.stoppedAt) : null;
    const durationMs = stoppedAt ? stoppedAt.getTime() - startedAt.getTime() : null;

    // Normalize status
    let status: PlatformExecution['status'] = 'unknown';
    switch (e.status) {
      case 'success':
        status = 'success';
        break;
      case 'error':
        status = 'error';
        break;
      case 'running':
        status = 'running';
        break;
      case 'waiting':
        status = 'waiting';
        break;
      case 'canceled':
        status = 'canceled';
        break;
    }

    return {
      id: e.id,
      workflowId: e.workflowId,
      workflowName: e.workflowName,
      status,
      mode: e.mode,
      startedAt: e.startedAt,
      stoppedAt: e.stoppedAt,
      durationMs,
      error: this.normalizeError(e.data?.resultData?.error),
    };
  }

  normalizeError(raw: unknown): PlatformExecutionError | null {
    if (!raw) return null;

    const e = raw as N8nExecutionRaw['data']['resultData']['error'];
    if (!e) return null;

    return {
      message: e.message || 'Unknown error',
      nodeName: e.node?.name,
      nodeType: e.node?.type,
      stack: e.stack,
      raw: e,
    };
  }
}

export function createN8nAdapter(config: PlatformConfig): N8nAdapter {
  return new N8nAdapter(config);
}



