// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}

export type MembershipRole = 'owner' | 'member';

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole;
  createdAt: Date;
}

// n8n Instance types
export type InstanceStatus = 'connected' | 'disconnected' | 'error';

export interface N8nInstance {
  id: string;
  organizationId: string;
  name: string;
  baseUrl: string;
  status: InstanceStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
}

// Workflow types
export interface Workflow {
  id: string;
  organizationId: string;
  n8nInstanceId: string;
  n8nWorkflowId: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowVersion {
  id: string;
  organizationId: string;
  workflowId: string;
  hash: string;
  jsonContent: Record<string, unknown>;
  label: string | null;
  variablesSnapshot?: WorkflowVariableSnapshot[];
  createdAt: Date;
}

export interface WorkflowVariableSnapshot {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string | null;
}

// Audit Log types
export type AuditAction = 
  | 'workflow.imported'
  | 'workflow.snapshot'
  | 'workflow.rollback'
  | 'instance.created'
  | 'instance.updated'
  | 'instance.deleted'
  | 'instance.connected'
  | 'settings.updated';

export interface AuditLog {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Org Settings
export interface OrgSettings {
  organizationId: string;
  slackWebhookUrl: string | null;
}

// n8n API types
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  tags?: Array<{ id: string; name: string }>;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

export interface N8nWorkflowListItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Diff types
export interface DiffSummary {
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  connectionsChanged: boolean;
  settingsChanged: boolean;
}

export interface NodeChange {
  type: 'added' | 'removed' | 'changed';
  nodeName: string;
  nodeType: string;
  details?: string[];
}

export interface ConnectionChange {
  type: 'added' | 'removed';
  source: string;
  target: string;
  outputIndex?: number;
  targetIndex?: number;
  connectionType?: string;
  edgeId?: string;
}

export interface OrgSsoConfigSummary {
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
}

export type IncidentEventType = 'execution_error' | 'deployment' | 'audit';

export interface IncidentEvent {
  id: string;
  type: IncidentEventType;
  workflowId: string | null;
  workflowName: string | null;
  instanceName?: string | null;
  timestamp: string;
  title: string;
  description?: string;
  severity?: 'critical' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
}

