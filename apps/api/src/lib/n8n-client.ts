import type { N8nWorkflow, N8nWorkflowListItem } from '@n8nback/shared';

export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
}

export interface N8nExecutionError {
  message: string;
  stack?: string;
  name?: string;
  description?: string;
  context?: {
    itemIndex?: number;
    runIndex?: number;
    parameter?: string;
  };
  node?: {
    name: string;
    type: string;
    position?: [number, number];
  };
  timestamp?: string;
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'cli' | 'integrated' | 'internal';
  retryOf: string | null;
  retrySuccessId: string | null;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  workflowName?: string;
  status: 'success' | 'error' | 'canceled' | 'waiting' | 'running' | 'new';
  data?: {
    resultData?: {
      error?: N8nExecutionError;
      lastNodeExecuted?: string;
    };
    executionData?: {
      nodeExecutionStack?: Array<{
        node: { name: string; type: string };
        data?: unknown;
      }>;
    };
  };
}

export class N8nApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: N8nClientConfig) {
    // Normalize base URL (remove trailing slash)
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

      if (response.status === 401 || response.status === 403) {
        throw new N8nApiError(
          'Invalid API key or insufficient permissions',
          response.status,
          responseBody
        );
      }

      throw new N8nApiError(
        `n8n API request failed: ${response.statusText}`,
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
      if (error instanceof N8nApiError) {
        throw error;
      }
      throw new N8nApiError('Failed to connect to n8n instance', 0, error);
    }
  }

  async listWorkflows(): Promise<N8nWorkflowListItem[]> {
    const response = await this.request<{ data: N8nWorkflowListItem[] }>(
      'GET',
      '/workflows'
    );
    return response.data;
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>('GET', `/workflows/${id}`);
  }

  async updateWorkflow(
    id: string,
    workflow: Partial<N8nWorkflow>
  ): Promise<N8nWorkflow> {
    return this.request<N8nWorkflow>('PUT', `/workflows/${id}`, workflow);
  }

  async createWorkflow(workflow: {
    name: string;
    nodes?: unknown[];
    connections?: unknown;
    settings?: unknown;
  }): Promise<{ id: string; name: string }> {
    return this.request<{ id: string; name: string }>('POST', '/workflows', workflow);
  }

  async activateWorkflow(id: string): Promise<void> {
    await this.request<{ success?: boolean }>(
      'POST',
      `/workflows/${id}/activate`
    );
  }

  async deactivateWorkflow(id: string): Promise<void> {
    await this.request<{ success?: boolean }>(
      'POST',
      `/workflows/${id}/deactivate`
    );
  }

  async listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
    includeData?: boolean;
  }): Promise<N8nExecution[]> {
    const searchParams = new URLSearchParams();
    if (params?.workflowId) searchParams.set('workflowId', params.workflowId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    // Include execution data to get error details
    if (params?.includeData !== false) {
      searchParams.set('includeData', 'true');
    }
    
    const query = searchParams.toString();
    const response = await this.request<{ data: N8nExecution[] }>(
      'GET',
      `/executions${query ? `?${query}` : ''}`
    );
    return response.data;
  }

  async getExecution(id: string, includeData = true): Promise<N8nExecution> {
    const query = includeData ? '?includeData=true' : '';
    return this.request<N8nExecution>('GET', `/executions/${id}${query}`);
  }

  // Get all failed executions across all workflows
  async listFailedExecutions(limit = 50): Promise<N8nExecution[]> {
    return this.listExecutions({ status: 'error', limit, includeData: true });
  }
}

export function createN8nClient(config: N8nClientConfig): N8nClient {
  return new N8nClient(config);
}
