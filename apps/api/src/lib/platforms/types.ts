/**
 * Abstract types for multi-platform automation tool support
 * Supports: n8n, Make (Integromat), Zapier, Activepieces, Node-RED, etc.
 */

// Platform identifier
export type PlatformType = 'n8n' | 'make' | 'zapier' | 'activepieces' | 'nodered' | 'pipedream';

// Common workflow representation
export interface PlatformWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Raw platform-specific data
  rawData: Record<string, unknown>;
}

// Common workflow list item (lighter)
export interface PlatformWorkflowListItem {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Common execution representation
export interface PlatformExecution {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: 'success' | 'error' | 'running' | 'waiting' | 'canceled' | 'unknown';
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  durationMs: number | null;
  error: PlatformExecutionError | null;
}

// Common error representation
export interface PlatformExecutionError {
  message: string;
  nodeName?: string;
  nodeType?: string;
  stack?: string;
  code?: string;
  httpStatus?: number;
  raw?: unknown;
}

// Platform configuration
export interface PlatformConfig {
  type: PlatformType;
  baseUrl: string;
  apiKey: string;
  // Platform-specific options
  options?: Record<string, unknown>;
}

// Platform capabilities (what features each platform supports)
export interface PlatformCapabilities {
  canListWorkflows: boolean;
  canGetWorkflow: boolean;
  canUpdateWorkflow: boolean;
  canCreateWorkflow: boolean;
  canDeleteWorkflow: boolean;
  canListExecutions: boolean;
  canGetExecution: boolean;
  canGetExecutionErrors: boolean;
  canActivateWorkflow: boolean;
  canDeactivateWorkflow: boolean;
  supportsWebhooks: boolean;
  supportsVersioning: boolean; // Native versioning support
}

// Platform API error
export class PlatformApiError extends Error {
  constructor(
    message: string,
    public platform: PlatformType,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

/**
 * Abstract interface for automation platform adapters
 * Each platform (n8n, Make, Zapier, etc.) implements this interface
 */
export interface IAutomationPlatform {
  // Platform info
  readonly type: PlatformType;
  readonly name: string;
  readonly capabilities: PlatformCapabilities;

  // Connection
  healthCheck(): Promise<boolean>;

  // Workflows
  listWorkflows(): Promise<PlatformWorkflowListItem[]>;
  getWorkflow(id: string): Promise<PlatformWorkflow>;
  updateWorkflow(id: string, data: Partial<PlatformWorkflow>): Promise<PlatformWorkflow>;
  createWorkflow?(data: Partial<PlatformWorkflow>): Promise<PlatformWorkflow>;
  deleteWorkflow?(id: string): Promise<boolean>;
  activateWorkflow?(id: string): Promise<boolean>;
  deactivateWorkflow?(id: string): Promise<boolean>;

  // Executions
  listExecutions(params?: {
    workflowId?: string;
    status?: string;
    limit?: number;
  }): Promise<PlatformExecution[]>;
  getExecution?(id: string): Promise<PlatformExecution>;

  // Utility
  normalizeWorkflow(raw: unknown): PlatformWorkflow;
  normalizeExecution(raw: unknown): PlatformExecution;
  normalizeError(raw: unknown): PlatformExecutionError | null;
}

/**
 * Platform display info for UI
 */
export const PLATFORM_INFO: Record<PlatformType, {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  website: string;
  description: string;
}> = {
  n8n: {
    name: 'n8n',
    displayName: 'n8n',
    icon: '⚡',
    color: '#FF6D5A',
    website: 'https://n8n.io',
    description: 'Open-source workflow automation',
  },
  make: {
    name: 'make',
    displayName: 'Make',
    icon: '🔮',
    color: '#6D29D9',
    website: 'https://make.com',
    description: 'Visual automation platform (formerly Integromat)',
  },
  zapier: {
    name: 'zapier',
    displayName: 'Zapier',
    icon: '⚡',
    color: '#FF4A00',
    website: 'https://zapier.com',
    description: 'No-code automation for everyone',
  },
  activepieces: {
    name: 'activepieces',
    displayName: 'Activepieces',
    icon: '🧩',
    color: '#6E41E2',
    website: 'https://activepieces.com',
    description: 'Open-source automation alternative',
  },
  nodered: {
    name: 'nodered',
    displayName: 'Node-RED',
    icon: '🔴',
    color: '#8F0000',
    website: 'https://nodered.org',
    description: 'Flow-based programming for IoT',
  },
  pipedream: {
    name: 'pipedream',
    displayName: 'Pipedream',
    icon: '🔧',
    color: '#059669',
    website: 'https://pipedream.com',
    description: 'Developer-focused automation',
  },
};



