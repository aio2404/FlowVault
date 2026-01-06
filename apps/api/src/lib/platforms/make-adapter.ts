/**
 * Make (Integromat) Platform Adapter
 * Implements IAutomationPlatform for Make scenarios
 * 
 * Make API Documentation: https://www.make.com/en/api-documentation
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

// Make calls workflows "scenarios"
interface MakeScenarioRaw {
  id: number;
  name: string;
  teamId: number;
  folderId: number | null;
  scheduling: {
    type: 'immediately' | 'indefinitely' | 'once' | 'daily' | 'weekly' | 'monthly';
    interval?: number;
  } | null;
  islinked: boolean; // whether scenario is active
  isPaused: boolean;
  created: string;
  lastEdit: string;
  usedPackages: string[];
  blueprint?: {
    flow: unknown[];
    metadata: unknown;
  };
}

interface MakeExecutionRaw {
  id: string;
  scenarioId: number;
  status: 'success' | 'warning' | 'error' | 'running';
  duration: number; // in milliseconds
  operations: number;
  transfer: number; // bytes
  started: string;
  finished: string | null;
  errorMessage?: string;
  errorType?: string;
  moduleName?: string; // The module (node) that failed
}

export class MakeAdapter implements IAutomationPlatform {
  readonly type: PlatformType = 'make';
  readonly name = 'Make (Integromat)';
  
  readonly capabilities: PlatformCapabilities = {
    canListWorkflows: true,
    canGetWorkflow: true,
    canUpdateWorkflow: true,
    canCreateWorkflow: false, // Requires complex blueprint
    canDeleteWorkflow: true,
    canListExecutions: true,
    canGetExecution: true,
    canGetExecutionErrors: true,
    canActivateWorkflow: true,
    canDeactivateWorkflow: true,
    supportsWebhooks: true,
    supportsVersioning: false,
  };

  private baseUrl: string;
  private apiKey: string;
  private teamId?: number;

  constructor(config: PlatformConfig) {
    if (config.type !== 'make') {
      throw new Error('MakeAdapter requires config.type to be "make"');
    }
    // Make API uses different regions
    this.baseUrl = config.baseUrl || 'https://eu1.make.com/api/v2';
    this.apiKey = config.apiKey;
    this.teamId = config.options?.teamId as number | undefined;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Token ${this.apiKey}`,
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
        `Make API request failed: ${response.statusText}`,
        'make',
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
      throw new PlatformApiError('Failed to connect to Make', 'make', 0, error);
    }
  }

  async listWorkflows(): Promise<PlatformWorkflowListItem[]> {
    const params = this.teamId ? `?teamId=${this.teamId}` : '';
    const response = await this.request<{ scenarios: MakeScenarioRaw[] }>(
      'GET',
      `/scenarios${params}`
    );
    return response.scenarios.map((s) => ({
      id: String(s.id),
      name: s.name,
      active: s.islinked && !s.isPaused,
      createdAt: s.created,
      updatedAt: s.lastEdit,
    }));
  }

  async getWorkflow(id: string): Promise<PlatformWorkflow> {
    const raw = await this.request<{ scenario: MakeScenarioRaw }>(
      'GET',
      `/scenarios/${id}?includes=blueprint`
    );
    return this.normalizeWorkflow(raw.scenario);
  }

  async updateWorkflow(
    id: string,
    data: Partial<PlatformWorkflow>
  ): Promise<PlatformWorkflow> {
    const payload: Record<string, unknown> = {};
    
    if (data.name) payload.name = data.name;
    if (data.rawData?.blueprint) payload.blueprint = data.rawData.blueprint;

    const raw = await this.request<{ scenario: MakeScenarioRaw }>(
      'PATCH',
      `/scenarios/${id}`,
      payload
    );
    return this.normalizeWorkflow(raw.scenario);
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await this.request('DELETE', `/scenarios/${id}`);
    return true;
  }

  async activateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/scenarios/${id}/start`);
    return true;
  }

  async deactivateWorkflow(id: string): Promise<boolean> {
    await this.request('POST', `/scenarios/${id}/stop`);
    return true;
  }

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
  }): Promise<PlatformExecution[]> {
    const searchParams = new URLSearchParams();
    if (params?.workflowId) searchParams.set('scenarioId', params.workflowId);
    if (params?.limit) searchParams.set('pg[limit]', String(params.limit));

    const query = searchParams.toString();
    const response = await this.request<{ scenarioLogs: MakeExecutionRaw[] }>(
      'GET',
      `/scenarios/${params?.workflowId}/logs${query ? `?${query}` : ''}`
    );
    return response.scenarioLogs.map((e) => this.normalizeExecution(e));
  }

  async getExecution(id: string): Promise<PlatformExecution> {
    // Make doesn't have individual execution endpoint, this is a limitation
    throw new PlatformApiError(
      'Make does not support fetching individual executions',
      'make',
      501
    );
  }

  normalizeWorkflow(raw: unknown): PlatformWorkflow {
    const s = raw as MakeScenarioRaw;
    return {
      id: String(s.id),
      name: s.name,
      active: s.islinked && !s.isPaused,
      createdAt: s.created,
      updatedAt: s.lastEdit,
      rawData: s as unknown as Record<string, unknown>,
    };
  }

  normalizeExecution(raw: unknown): PlatformExecution {
    const e = raw as MakeExecutionRaw;
    
    let status: PlatformExecution['status'] = 'unknown';
    switch (e.status) {
      case 'success':
        status = 'success';
        break;
      case 'error':
      case 'warning':
        status = 'error';
        break;
      case 'running':
        status = 'running';
        break;
    }

    return {
      id: e.id,
      workflowId: String(e.scenarioId),
      status,
      mode: 'trigger', // Make doesn't distinguish modes the same way
      startedAt: e.started,
      stoppedAt: e.finished,
      durationMs: e.duration,
      error: this.normalizeError(e),
    };
  }

  normalizeError(raw: unknown): PlatformExecutionError | null {
    const e = raw as MakeExecutionRaw;
    if (!e.errorMessage) return null;

    return {
      message: e.errorMessage,
      nodeName: e.moduleName,
      code: e.errorType,
      raw: e,
    };
  }
}

export function createMakeAdapter(config: PlatformConfig): MakeAdapter {
  return new MakeAdapter(config);
}



