/**
 * Activepieces Platform Adapter
 * Implements IAutomationPlatform for Activepieces flows
 * 
 * Activepieces API Documentation: https://www.activepieces.com/docs/developers/overview
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

// Activepieces calls workflows "flows"
interface ActivepiecesFlowRaw {
  id: string;
  projectId: string;
  folderId: string | null;
  status: 'ENABLED' | 'DISABLED';
  schedule: unknown | null;
  created: string;
  updated: string;
  version: {
    id: string;
    flowId: string;
    displayName: string;
    trigger: unknown;
    valid: boolean;
    state: 'DRAFT' | 'LOCKED';
    created: string;
    updated: string;
  };
}

interface ActivepiecesRunRaw {
  id: string;
  projectId: string;
  flowId: string;
  flowVersionId: string;
  flowDisplayName: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'PAUSED' | 'INTERNAL_ERROR';
  startTime: string;
  finishTime: string | null;
  duration: number | null;
  environment: 'PRODUCTION' | 'TESTING';
  terminationReason?: string;
  logsFileId?: string;
  errorMessage?: string;
  steps?: Array<{
    stepName: string;
    status: string;
    errorMessage?: string;
  }>;
}

export class ActivepiecesAdapter implements IAutomationPlatform {
  readonly type: PlatformType = 'activepieces';
  readonly name = 'Activepieces';
  
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
    supportsVersioning: true, // Activepieces has native versioning!
  };

  private baseUrl: string;
  private apiKey: string;

  constructor(config: PlatformConfig) {
    if (config.type !== 'activepieces') {
      throw new Error('ActivepiecesAdapter requires config.type to be "activepieces"');
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
      'Authorization': `Bearer ${this.apiKey}`,
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
        `Activepieces API request failed: ${response.statusText}`,
        'activepieces',
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
      throw new PlatformApiError('Failed to connect to Activepieces', 'activepieces', 0, error);
    }
  }

  async listWorkflows(): Promise<PlatformWorkflowListItem[]> {
    const response = await this.request<{ data: ActivepiecesFlowRaw[] }>(
      'GET',
      '/flows'
    );
    return response.data.map((f) => ({
      id: f.id,
      name: f.version.displayName,
      active: f.status === 'ENABLED',
      createdAt: f.created,
      updatedAt: f.updated,
    }));
  }

  async getWorkflow(id: string): Promise<PlatformWorkflow> {
    const raw = await this.request<ActivepiecesFlowRaw>('GET', `/flows/${id}`);
    return this.normalizeWorkflow(raw);
  }

  async updateWorkflow(
    id: string,
    data: Partial<PlatformWorkflow>
  ): Promise<PlatformWorkflow> {
    const payload: Record<string, unknown> = {};
    
    if (data.name) {
      payload.displayName = data.name;
    }
    if (data.rawData?.trigger) {
      payload.trigger = data.rawData.trigger;
    }

    const raw = await this.request<ActivepiecesFlowRaw>(
      'POST',
      `/flows/${id}`,
      payload
    );
    return this.normalizeWorkflow(raw);
  }

  async createWorkflow(data: Partial<PlatformWorkflow>): Promise<PlatformWorkflow> {
    const payload = {
      displayName: data.name || 'New Flow',
      folderId: null,
    };

    const raw = await this.request<ActivepiecesFlowRaw>('POST', '/flows', payload);
    return this.normalizeWorkflow(raw);
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await this.request('DELETE', `/flows/${id}`);
    return true;
  }

  async activateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/flows/${id}/status`, { status: 'ENABLED' });
    return true;
  }

  async deactivateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/flows/${id}/status`, { status: 'DISABLED' });
    return true;
  }

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
  }): Promise<PlatformExecution[]> {
    const searchParams = new URLSearchParams();
    if (params?.workflowId) searchParams.set('flowId', params.workflowId);
    if (params?.status) searchParams.set('status', params.status.toUpperCase());
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    const response = await this.request<{ data: ActivepiecesRunRaw[] }>(
      'GET',
      `/flow-runs${query ? `?${query}` : ''}`
    );
    return response.data.map((r) => this.normalizeExecution(r));
  }

  async getExecution(id: string): Promise<PlatformExecution> {
    const raw = await this.request<ActivepiecesRunRaw>('GET', `/flow-runs/${id}`);
    return this.normalizeExecution(raw);
  }

  normalizeWorkflow(raw: unknown): PlatformWorkflow {
    const f = raw as ActivepiecesFlowRaw;
    return {
      id: f.id,
      name: f.version.displayName,
      active: f.status === 'ENABLED',
      createdAt: f.created,
      updatedAt: f.updated,
      rawData: f as unknown as Record<string, unknown>,
    };
  }

  normalizeExecution(raw: unknown): PlatformExecution {
    const r = raw as ActivepiecesRunRaw;
    
    let status: PlatformExecution['status'] = 'unknown';
    switch (r.status) {
      case 'SUCCEEDED':
        status = 'success';
        break;
      case 'FAILED':
      case 'TIMEOUT':
      case 'INTERNAL_ERROR':
        status = 'error';
        break;
      case 'RUNNING':
        status = 'running';
        break;
      case 'PAUSED':
        status = 'waiting';
        break;
    }

    return {
      id: r.id,
      workflowId: r.flowId,
      workflowName: r.flowDisplayName,
      status,
      mode: r.environment.toLowerCase(),
      startedAt: r.startTime,
      stoppedAt: r.finishTime,
      durationMs: r.duration,
      error: this.normalizeError(r),
    };
  }

  normalizeError(raw: unknown): PlatformExecutionError | null {
    const r = raw as ActivepiecesRunRaw;
    if (r.status !== 'FAILED' && r.status !== 'INTERNAL_ERROR' && r.status !== 'TIMEOUT') {
      return null;
    }

    // Find the failed step
    const failedStep = r.steps?.find(s => s.status === 'FAILED');

    return {
      message: r.errorMessage || r.terminationReason || 'Unknown error',
      nodeName: failedStep?.stepName,
      raw: r,
    };
  }
}

export function createActivepiecesAdapter(config: PlatformConfig): ActivepiecesAdapter {
  return new ActivepiecesAdapter(config);
}



