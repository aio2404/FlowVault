'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useAuthStore, useToastStore } from '@/lib/store';
import { workflowApi, instanceApi } from '@/lib/api';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import {
  GitBranch,
  Clock,
  RotateCcw,
  Camera,
  Loader2,
  ArrowLeft,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  Check,
  Eye,
  Code,
  Download,
  ChevronDown,
  Rocket,
  Variable,
  Trash2,
  Lock,
  ArrowRight,
  Target,
  Wrench,
  ClipboardList,
  Shield,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { VisualDiff } from '@/components/visual-diff';
import { WorkflowCanvas, WorkflowDiffCanvas, WorkflowChangeStatus } from '@/components/workflow-canvas';
import { ExecutionHistory } from '@/components/execution-history';
import { ErrorTracker } from '@/components/error-tracker';

interface WorkflowVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  description: string | null;
}

type QuarantineStrategy = 'pause' | 'rollback_full' | 'rollback_nodes' | 'variables_only';

interface QuarantineConfigState {
  enabled: boolean;
  strategy: QuarantineStrategy;
  threshold: number;
  windowMinutes: number;
  versionId: string | null;
  nodeNames: string[];
  includeConnections: boolean;
  notify: boolean;
}

interface QuarantineEvent {
  id: string;
  action: string;
  reason: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

const DEFAULT_QUARANTINE_CONFIG: QuarantineConfigState = {
  enabled: false,
  strategy: 'pause',
  threshold: 3,
  windowMinutes: 15,
  versionId: null,
  nodeNames: [],
  includeConnections: true,
  notify: true,
};

interface Workflow {
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
  quarantineConfig: QuarantineConfigState;
  quarantineTimeline?: QuarantineEvent[];
  variables: WorkflowVariable[];
  promotionRequests?: PromotionRequest[];
}

interface PromotionRequest {
  id: string;
  status: 'draft' | 'ready_for_review' | 'approved' | 'rejected';
  checklist: Array<{ key: string; label: string; status: 'pending' | 'pass' | 'fail'; required: boolean; notes?: string }>;
  targetEnvironment: string;
  targetInstanceId: string | null;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
  createdBy?: { id: string; email: string; name: string | null } | null;
  reviewer?: { id: string; email: string; name: string | null } | null;
}

const CHECK_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

const PROMOTION_STATUS_LABEL: Record<PromotionRequest['status'], string> = {
  draft: 'Draft',
  ready_for_review: 'Ready for review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ENVIRONMENTS = [
  { value: 'development', label: 'Development', color: 'bg-blue-500' },
  { value: 'staging', label: 'Staging', color: 'bg-yellow-500' },
  { value: 'production', label: 'Production', color: 'bg-red-500' },
];

const DIFF_STATUS_OPTIONS: Array<{
  key: WorkflowChangeStatus;
  label: string;
  dotClass: string;
  description: string;
}> = [
  { key: 'added', label: 'Added', dotClass: 'bg-green-500', description: 'New nodes introduced in the newer version.' },
  { key: 'removed', label: 'Removed', dotClass: 'bg-red-500', description: 'Nodes that were deleted when moving to the new version.' },
  { key: 'changed', label: 'Changed', dotClass: 'bg-yellow-500', description: 'Nodes that were edited (parameters, credentials, position, etc.).' },
  { key: 'unchanged', label: 'Unchanged', dotClass: 'bg-muted-foreground', description: 'Context nodes with no differences between versions.' },
];

interface Version {
  id: string;
  hash: string;
  label: string | null;
  versionNumber: number;
  createdAt: string;
}

interface DiffData {
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
}

interface Execution {
  id: string;
  n8nExecutionId: string;
  status: string;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const { token, currentOrgId } = useAuthStore();
  const { addToast } = useToastStore();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  // Diff state
  const [selectedVersions, setSelectedVersions] = useState<[string | null, string | null]>([null, null]);
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [activeDiffStatuses, setActiveDiffStatuses] = useState<WorkflowChangeStatus[]>(['added', 'removed', 'changed']);
  const [hideUnselectedNodes, setHideUnselectedNodes] = useState(false);

  // Rollback state
  const [rollbackVersion, setRollbackVersion] = useState<Version | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<Version | null>(null);
  const [restoreMode, setRestoreMode] = useState<'full' | 'nodes' | 'variables' | 'singleNode'>('nodes');
  const [restoreNodesInput, setRestoreNodesInput] = useState('');
  const [restoreIncludeConnections, setRestoreIncludeConnections] = useState(true);
  const [restoring, setRestoring] = useState(false);

  // Executions state
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [syncingExecutions, setSyncingExecutions] = useState(false);

  // Environment & Variables state
  const [changingEnv, setChangingEnv] = useState(false);
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [newVariable, setNewVariable] = useState({ key: '', value: '', isSecret: false, description: '' });
  const [savingVariable, setSavingVariable] = useState(false);
  const [deletingVariableId, setDeletingVariableId] = useState<string | null>(null);

  // Promotion state
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoteTarget, setPromoteTarget] = useState({ environment: 'staging', instanceId: '', copyVariables: true });
  const [promoting, setPromoting] = useState(false);
  const [instances, setInstances] = useState<Array<{ id: string; name: string }>>([]);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [showPromotionDrawer, setShowPromotionDrawer] = useState(false);
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [updatingChecklistId, setUpdatingChecklistId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [autoConfig, setAutoConfig] = useState<QuarantineConfigState>(DEFAULT_QUARANTINE_CONFIG);
  const [nodeNamesField, setNodeNamesField] = useState('');
  const [savingAutoConfig, setSavingAutoConfig] = useState(false);
  const [releasingWorkflow, setReleasingWorkflow] = useState(false);
  const [forcingQuarantine, setForcingQuarantine] = useState(false);

  useEffect(() => {
    loadWorkflow();
    loadExecutions();
    loadInstances();
  }, [workflowId, token, currentOrgId]);

  const loadWorkflow = async () => {
    if (!token || !currentOrgId) return;

    try {
      const [wf, versionsRes, promotionsRes] = await Promise.all([
        workflowApi.get(token, currentOrgId, workflowId),
        workflowApi.listVersions(token, currentOrgId, workflowId),
        workflowApi.listPromotionRequests(token, currentOrgId, workflowId),
      ]);
      setWorkflow(wf);
      setAutoConfig(wf.quarantineConfig ?? DEFAULT_QUARANTINE_CONFIG);
      setNodeNamesField((wf.quarantineConfig?.nodeNames ?? []).join(', '));
      setPromotionRequests(promotionsRes.promotionRequests);
      setVersions(versionsRes.versions);

      // Auto-select first two versions for diff
      if (versionsRes.versions.length >= 2) {
        setSelectedVersions([versionsRes.versions[1]!.id, versionsRes.versions[0]!.id]);
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      addToast({ title: 'Failed to load workflow', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    if (!token || !currentOrgId) return;
    setLoadingExecutions(true);
    try {
      const result = await workflowApi.getExecutions(token, currentOrgId, workflowId, { limit: 20 });
      setExecutions(result.executions);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const syncExecutions = async () => {
    if (!token || !currentOrgId) return;
    setSyncingExecutions(true);
    try {
      const result = await workflowApi.syncExecutions(token, currentOrgId, workflowId);
      if (result.success) {
        addToast({ title: `Synced ${result.synced} executions`, variant: 'success' });
        loadExecutions();
      } else {
        addToast({ title: 'Failed to sync executions', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      addToast({ title: 'Failed to sync executions', variant: 'destructive' });
    } finally {
      setSyncingExecutions(false);
    }
  };

  const loadInstances = async () => {
    if (!token || !currentOrgId) return;
    try {
      const result = await instanceApi.list(token, currentOrgId);
      setInstances(result.instances.map(i => ({ id: i.id, name: i.name })));
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  };

  const changeEnvironment = async (newEnv: string) => {
    if (!token || !currentOrgId || !workflow) return;
    setChangingEnv(true);
    try {
      await workflowApi.update(token, currentOrgId, workflowId, { environment: newEnv });
      setWorkflow({ ...workflow, environment: newEnv });
      addToast({ title: `Environment changed to ${newEnv}`, variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to change environment', variant: 'destructive' });
    } finally {
      setChangingEnv(false);
    }
  };

  const handleNodeNamesInput = (value: string) => {
    setNodeNamesField(value);
    const parsed = value
      .split(',')
      .map((node) => node.trim())
      .filter((node) => node.length > 0);
    setAutoConfig((prev) => ({ ...prev, nodeNames: parsed }));
  };

  const saveQuarantineConfig = async () => {
    if (!token || !currentOrgId) return;
    setSavingAutoConfig(true);
    try {
      await workflowApi.update(token, currentOrgId, workflowId, {
        quarantineConfig: {
          enabled: autoConfig.enabled,
          strategy: autoConfig.strategy,
          threshold: autoConfig.threshold,
          windowMinutes: autoConfig.windowMinutes,
          versionId: autoConfig.versionId,
          nodeNames: autoConfig.nodeNames,
          includeConnections: autoConfig.includeConnections,
          notify: autoConfig.notify,
        },
      });
      addToast({ title: 'Auto-remediation updated', variant: 'success' });
      setWorkflow((prev) =>
        prev
          ? {
              ...prev,
              quarantineConfig: { ...autoConfig },
            }
          : prev
      );
    } catch (error) {
      addToast({
        title: 'Failed to save auto-remediation',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingAutoConfig(false);
    }
  };

  const releaseWorkflow = async () => {
    if (!token || !currentOrgId) return;
    setReleasingWorkflow(true);
    try {
      await workflowApi.release(token, currentOrgId, workflowId);
      addToast({ title: 'Workflow released', variant: 'success' });
      await loadWorkflow();
    } catch (error) {
      addToast({
        title: 'Failed to release workflow',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setReleasingWorkflow(false);
    }
  };

  const forceQuarantine = async () => {
    if (!token || !currentOrgId) return;
    setForcingQuarantine(true);
    try {
      await workflowApi.quarantine(token, currentOrgId, workflowId, {
        action: 'pause',
        reason: 'Manual quarantine',
      });
      addToast({ title: 'Workflow quarantined', variant: 'warning' });
      await loadWorkflow();
    } catch (error) {
      addToast({
        title: 'Failed to quarantine workflow',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setForcingQuarantine(false);
    }
  };

  const addVariable = async () => {
    if (!token || !currentOrgId || !newVariable.key) return;
    setSavingVariable(true);
    try {
      const result = await workflowApi.setVariable(token, currentOrgId, workflowId, newVariable);
      if (workflow) {
        const exists = workflow.variables.find(v => v.key === result.variable.key);
        const newVars = exists
          ? workflow.variables.map(v => v.key === result.variable.key ? result.variable : v)
          : [...workflow.variables, result.variable];
        setWorkflow({ ...workflow, variables: newVars });
      }
      setNewVariable({ key: '', value: '', isSecret: false, description: '' });
      setShowVariableDialog(false);
      addToast({ title: 'Variable saved', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to save variable', variant: 'destructive' });
    } finally {
      setSavingVariable(false);
    }
  };

  const deleteVariable = async (variableId: string) => {
    if (!token || !currentOrgId) return;
    setDeletingVariableId(variableId);
    try {
      await workflowApi.deleteVariable(token, currentOrgId, workflowId, variableId);
      if (workflow) {
        setWorkflow({ ...workflow, variables: workflow.variables.filter(v => v.id !== variableId) });
      }
      addToast({ title: 'Variable deleted', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to delete variable', variant: 'destructive' });
    } finally {
      setDeletingVariableId(null);
    }
  };

  const promoteWorkflow = async () => {
    if (!token || !currentOrgId || !workflow) return;
    setPromoting(true);
    try {
      const result = await workflowApi.promote(token, currentOrgId, workflowId, {
        targetEnvironment: promoteTarget.environment,
        targetInstanceId: promoteTarget.instanceId || undefined,
        copyVariables: promoteTarget.copyVariables,
      });
      addToast({
        title: 'Workflow promoted!',
        description: `Now in ${result.promotedWorkflow.environment} on ${result.promotedWorkflow.instanceName}`,
        variant: 'success',
      });
      setShowPromoteDialog(false);
      if (result.promotedWorkflow.id !== workflowId) {
        // New workflow created, navigate to it
        router.push(`/app/workflows/${result.promotedWorkflow.id}`);
      } else {
        loadWorkflow();
      }
    } catch (error) {
      addToast({
        title: 'Promotion failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setPromoting(false);
    }
  };

  const createPromotionRequest = async () => {
    if (!token || !currentOrgId) return;
    setCreatingPromotion(true);
    try {
      const res = await workflowApi.createPromotionRequest(token, currentOrgId, workflowId, {
        targetEnvironment: promoteTarget.environment,
        targetInstanceId: promoteTarget.instanceId || undefined,
      });
      setPromotionRequests((prev) => [res.promotionRequest, ...prev]);
      await refreshPromotionRequests();
      addToast({ title: 'Promotion request created', variant: 'success' });
      setShowPromotionDrawer(true);
      setShowPromoteDialog(false);
    } catch (error) {
      addToast({
        title: 'Failed to create promotion request',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setCreatingPromotion(false);
    }
  };

  const refreshPromotionRequests = async () => {
    if (!token || !currentOrgId) return;
    try {
      const res = await workflowApi.listPromotionRequests(token, currentOrgId, workflowId);
      setPromotionRequests(res.promotionRequests);
    } catch (error) {
      console.error('Failed to load promotion requests:', error);
    }
  };

  useEffect(() => {
    refreshPromotionRequests();
  }, [token, currentOrgId, workflowId]);

  const handleChecklistUpdate = async (
    requestId: string,
    checkKey: string,
    status: 'pending' | 'pass' | 'fail'
  ) => {
    if (!token || !currentOrgId) return;
    setUpdatingChecklistId(requestId);
    try {
      const res = await workflowApi.updatePromotionChecklist(token, currentOrgId, requestId, {
        checks: [{ key: checkKey, status }],
      });
      setPromotionRequests((prev) =>
        prev.map((pr) =>
          pr.id === requestId ? { ...pr, checklist: res.checklist } : pr
        )
      );
    } catch (error) {
      addToast({
        title: 'Failed to update checklist',
        variant: 'destructive',
      });
    } finally {
      setUpdatingChecklistId(null);
    }
  };

  const handlePromotionStatusChange = async (
    requestId: string,
    status: 'ready_for_review' | 'approved' | 'rejected'
  ) => {
    if (!token || !currentOrgId) return;
    setUpdatingStatusId(requestId);
    try {
      const res = await workflowApi.updatePromotionStatus(token, currentOrgId, requestId, status);
      setPromotionRequests((prev) =>
        prev.map((pr) => (pr.id === requestId ? res.promotionRequest : pr))
      );
      addToast({
        title: `Promotion ${status.replace(/_/g, ' ')}`,
        variant: status === 'approved' ? 'success' : status === 'rejected' ? 'destructive' : 'default',
      });
    } catch (error) {
      addToast({
        title: 'Failed to update promotion request',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  useEffect(() => {
    loadDiff();
  }, [selectedVersions]);

  const loadDiff = async () => {
    if (!token || !currentOrgId || !selectedVersions[0] || !selectedVersions[1]) {
      setDiffData(null);
      return;
    }

    setLoadingDiff(true);

    try {
      const diff = await workflowApi.getDiff(
        token,
        currentOrgId,
        workflowId,
        selectedVersions[0],
        selectedVersions[1]
      );
      setDiffData(diff);
    } catch (error) {
      console.error('Failed to load diff:', error);
    } finally {
      setLoadingDiff(false);
    }
  };

  const toggleDiffStatus = (status: WorkflowChangeStatus) => {
    setActiveDiffStatuses((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  };

  const resetDiffStatusFilters = () => {
    setActiveDiffStatuses(['added', 'removed', 'changed']);
  };

  const visibleDiffStatuses = useMemo<WorkflowChangeStatus[]>(() => {
    return activeDiffStatuses.length > 0
      ? activeDiffStatuses
      : (['added', 'removed', 'changed', 'unchanged'] as WorkflowChangeStatus[]);
  }, [activeDiffStatuses]);

  const connectionStats = useMemo(() => {
    if (!diffData) {
      return { added: 0, removed: 0 };
    }
    const added = diffData.connectionChanges.filter((c) => c.type === 'added').length;
    const removed = diffData.connectionChanges.filter((c) => c.type === 'removed').length;
    return { added, removed };
  }, [diffData]);

  const impactedNodeCount = diffData?.nodeChanges.length ?? 0;

  const handleSnapshot = async () => {
    if (!token || !currentOrgId) return;

    setSnapshotting(true);

    try {
      const result = await workflowApi.snapshot(token, currentOrgId, workflowId);
      if (result.created) {
        addToast({ title: 'Snapshot created!', variant: 'success' });
        loadWorkflow();
      } else {
        addToast({ title: 'No changes detected', description: result.message });
      }
    } catch (error) {
      addToast({
        title: 'Snapshot failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSnapshotting(false);
    }
  };

  const handleRollback = async () => {
    if (!token || !currentOrgId || !rollbackVersion) return;

    setRollingBack(true);

    try {
      const result = await workflowApi.rollback(token, currentOrgId, workflowId, rollbackVersion.id);
      if (result.success) {
        addToast({ title: 'Rollback successful!', variant: 'success' });
        setRollbackVersion(null);
        loadWorkflow();
      } else {
        addToast({ title: 'Rollback failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      addToast({
        title: 'Rollback failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setRollingBack(false);
    }
  };

  const openRestoreDialog = (version: Version) => {
    setRestoreVersion(version);
    setRestoreMode('nodes');
    setRestoreNodesInput('');
    setRestoreIncludeConnections(true);
    setShowRestoreDialog(true);
  };

  const handleTargetedRestore = async () => {
    if (!token || !currentOrgId || !restoreVersion) return;
    setRestoring(true);
    try {
      const nodeNames =
        restoreMode === 'singleNode'
          ? restoreNodesInput
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
          : undefined;

      const payload: {
        versionId: string;
        mode: 'full' | 'nodes' | 'variables' | 'singleNode';
        nodeNames?: string[];
        includeConnections?: boolean;
      } = {
        versionId: restoreVersion.id,
        mode: restoreMode,
      };

      if (nodeNames && nodeNames.length > 0) {
        payload.nodeNames = nodeNames;
      }
      if (restoreMode === 'nodes' || restoreMode === 'singleNode') {
        payload.includeConnections = restoreIncludeConnections;
      }

      const result = await workflowApi.targetedRestore(
        token,
        currentOrgId,
        workflowId,
        payload
      );

      addToast({
        title: 'Restore completed',
        description: `Mode: ${result.mode}`,
        variant: 'success',
      });
      setShowRestoreDialog(false);
      await loadWorkflow();
      if (selectedVersions[0] && selectedVersions[1]) {
        await loadDiff();
      }
    } catch (error) {
      addToast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev[0] === versionId) {
        return [prev[1], null];
      }
      if (prev[1] === versionId) {
        return [prev[0], null];
      }
      if (!prev[0]) {
        return [versionId, prev[1]];
      }
      if (!prev[1]) {
        return [prev[0], versionId];
      }
      // Replace older selection
      return [prev[1], versionId];
    });
  };

  const downloadVersion = async (version: Version) => {
    if (!token || !currentOrgId) return;

    try {
      const data = await workflowApi.getVersion(token, currentOrgId, workflowId, version.id);
      const blob = new Blob([JSON.stringify(data.jsonContent, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow?.name || 'workflow'}_v${version.versionNumber}_${version.hash}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ title: 'Version downloaded!', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Workflow not found</p>
        <Button variant="outline" onClick={() => router.push('/app/workflows')} className="mt-4">
          Back to Workflows
        </Button>
      </div>
    );
  }

  const currentEnv = ENVIRONMENTS.find(e => e.value === workflow.environment) || ENVIRONMENTS[0]!;
  const isQuarantined = workflow.status === 'quarantined';
  const timeline = workflow.quarantineTimeline ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/app/workflows"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workflows
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{workflow.name}</h1>
                <Badge variant={workflow.active ? 'success' : 'secondary'}>
                  {workflow.active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge
                  variant={workflow.status === 'quarantined' ? 'destructive' : 'outline'}
                >
                  {workflow.status === 'quarantined' ? 'Quarantined' : 'Healthy'}
                </Badge>
                {/* Environment Badge with Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 gap-1" disabled={changingEnv}>
                      <span className={cn('w-2 h-2 rounded-full', currentEnv.color)} />
                      {currentEnv.label}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ENVIRONMENTS.map(env => (
                      <DropdownMenuItem
                        key={env.value}
                        onClick={() => changeEnvironment(env.value)}
                        className={cn(
                          'flex items-center gap-2',
                          env.value === workflow.environment && 'bg-primary/10'
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full', env.color)} />
                        {env.label}
                        {env.value === workflow.environment && <Check className="w-3 h-3 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-muted-foreground">
                {workflow.instanceName} • {workflow.versionCount} versions
                {workflow.promotedFrom && (
                  <span className="text-xs ml-2 text-primary">
                    • Promoted {workflow.promotedAt ? formatRelativeTime(workflow.promotedAt) : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPromotionDrawer(true)}
            className="hidden sm:flex"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Promotion requests
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              setPromoteTarget({ 
                environment: workflow.environment === 'development' ? 'staging' : 'production',
                instanceId: '',
                copyVariables: true 
              });
              setShowPromoteDialog(true);
            }}
          >
            <Rocket className="w-4 h-4 mr-2" />
            Promote
          </Button>
          <Button onClick={handleSnapshot} disabled={snapshotting}>
            {snapshotting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-2" />
            )}
            Snapshot Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Workflow health
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor quarantine state and control the rollout of this workflow.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Status
              </p>
              <p
                className={cn(
                  'text-xl font-semibold',
                  isQuarantined ? 'text-destructive' : 'text-success'
                )}
              >
                {isQuarantined ? 'Quarantined' : 'Healthy'}
              </p>
              {workflow.quarantineReason && (
                <p className="text-sm text-muted-foreground mt-2">
                  {workflow.quarantineReason}
                </p>
              )}
              {workflow.quarantineSince && (
                <p className="text-xs text-muted-foreground mt-1">
                  Since {formatRelativeTime(workflow.quarantineSince)}
                </p>
              )}
              {!workflow.quarantineReason && !isQuarantined && (
                <p className="text-xs text-muted-foreground mt-1">
                  No incidents detected.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={releaseWorkflow}
                disabled={!isQuarantined || releasingWorkflow}
              >
                {releasingWorkflow && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                Release workflow
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={forceQuarantine}
                disabled={isQuarantined || forcingQuarantine}
              >
                {forcingQuarantine && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                Quarantine now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Auto-remediation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure FlowVault to pause or rollback when error rates spike.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">Auto-quarantine</p>
                    <p className="text-xs text-muted-foreground">
                      {autoConfig.enabled
                        ? `Triggered after ${autoConfig.threshold} errors in ${autoConfig.windowMinutes} min`
                        : 'Disabled'}
                    </p>
                  </div>
                  <Checkbox
                    checked={autoConfig.enabled}
                    onCheckedChange={(checked) =>
                      setAutoConfig((prev) => ({ ...prev, enabled: checked === true }))
                    }
                    className="h-5 w-5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Error threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      value={autoConfig.threshold}
                      onChange={(e) =>
                        setAutoConfig((prev) => ({
                          ...prev,
                          threshold: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Window (min)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={autoConfig.windowMinutes}
                      onChange={(e) =>
                        setAutoConfig((prev) => ({
                          ...prev,
                          windowMinutes: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Strategy</Label>
                  <Select
                    value={autoConfig.strategy}
                    onValueChange={(value) =>
                      setAutoConfig((prev) => ({
                        ...prev,
                        strategy: value as QuarantineStrategy,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pause">Pause workflow</SelectItem>
                      <SelectItem value="rollback_full">Full rollback</SelectItem>
                      <SelectItem value="rollback_nodes">Restore nodes</SelectItem>
                      <SelectItem value="variables_only">Variables only</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {autoConfig.strategy === 'pause'
                      ? 'Simply disable the workflow when threshold is exceeded.'
                      : autoConfig.strategy === 'rollback_full'
                      ? 'Re-publish the last snapshot before pausing the workflow.'
                      : autoConfig.strategy === 'rollback_nodes'
                      ? 'Replace matching nodes from the last healthy version.'
                      : 'Only restore variables before pausing the workflow.'}
                  </p>
                </div>

                {autoConfig.strategy === 'rollback_nodes' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Node names</Label>
                      <Input
                        placeholder="HTTP Request, Slack"
                        value={nodeNamesField}
                        onChange={(e) => handleNodeNamesInput(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma separated list of nodes to restore when triggering remediation.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={autoConfig.includeConnections}
                        onCheckedChange={(checked) =>
                          setAutoConfig((prev) => ({
                            ...prev,
                            includeConnections: checked === true,
                          }))
                        }
                      />
                      Restore connections too
                    </label>
                  </>
                )}

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={autoConfig.notify}
                    onCheckedChange={(checked) =>
                      setAutoConfig((prev) => ({ ...prev, notify: checked === true }))
                    }
                  />
                  Send notifications when quarantined
                </label>

                <Button
                  size="sm"
                  onClick={saveQuarantineConfig}
                  disabled={savingAutoConfig}
                >
                  {savingAutoConfig && (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  )}
                  Save configuration
                </Button>
              </div>

              <div className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Incident timeline
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last quarantine actions and auto-remediation details.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {timeline.length} event{timeline.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No quarantine events yet.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-auto">
                    {timeline.map((event) => {
                      const eventMeta = (event.metadata ?? {}) as Record<string, unknown>;
                      const errorCount = eventMeta?.errorCount as number | undefined;
                      const windowMinutes = eventMeta?.windowMinutes as number | undefined;
                      return (
                        <div
                          key={event.id}
                          className="p-3 rounded-lg border border-border/40 bg-muted/20"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium capitalize">
                              {event.action.replace(/_/g, ' ')}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(event.createdAt)}
                            </span>
                          </div>
                          {event.reason && (
                            <p className="text-sm text-muted-foreground mt-1">{event.reason}</p>
                          )}
                          {errorCount !== undefined && windowMinutes !== undefined && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {errorCount} errors in {windowMinutes} minutes
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Versions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select two versions to compare
            </p>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-auto">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No versions yet
              </p>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => {
                  const isSelected =
                    selectedVersions[0] === version.id || selectedVersions[1] === version.id;
                  const selectionIndex = selectedVersions.indexOf(version.id);

                  return (
                    <div
                      key={version.id}
                      className={cn(
                        'group p-3 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted'
                      )}
                      onClick={() => toggleVersionSelection(version.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {isSelected ? (selectionIndex === 0 ? 'A' : 'B') : version.versionNumber}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {version.hash}
                              </code>
                            </div>
                            {version.label && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {version.label}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeTime(version.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRestoreDialog(version);
                            }}
                            title="Targeted restore"
                          >
                            <Target className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadVersion(version);
                            }}
                            title="Download JSON"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRollbackVersion(version);
                            }}
                            title="Rollback to this version"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diff viewer */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Changes</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedVersions[0] || !selectedVersions[1] ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Select two versions to see the diff</p>
              </div>
            ) : loadingDiff ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : diffData ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <Plus className="w-5 h-5 text-success mx-auto mb-1" />
                    <p className="text-2xl font-bold text-success">{diffData.summary.nodesAdded}</p>
                    <p className="text-xs text-muted-foreground">Added</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <Minus className="w-5 h-5 text-destructive mx-auto mb-1" />
                    <p className="text-2xl font-bold text-destructive">{diffData.summary.nodesRemoved}</p>
                    <p className="text-xs text-muted-foreground">Removed</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10 text-center">
                    <RefreshCw className="w-5 h-5 text-warning mx-auto mb-1" />
                    <p className="text-2xl font-bold text-warning">{diffData.summary.nodesChanged}</p>
                    <p className="text-xs text-muted-foreground">Changed</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-border/60 bg-card/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Connections</span>
                      <Badge variant="outline" className={cn('capitalize', diffData.summary.connectionsChanged ? 'text-warning border-warning/40' : 'text-muted-foreground')}>
                        {diffData.summary.connectionsChanged ? 'Changed' : 'Unchanged'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-xl font-semibold text-success">+{connectionStats.added}</p>
                        <p className="text-xs text-muted-foreground">Added</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-destructive">-{connectionStats.removed}</p>
                        <p className="text-xs text-muted-foreground">Removed</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border border-border/60 bg-card/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Workflow settings</span>
                      <Badge variant="outline" className={cn(diffData.summary.settingsChanged ? 'text-warning border-warning/40' : 'text-muted-foreground')}>
                        {diffData.summary.settingsChanged ? 'Updated' : 'Unchanged'}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      Settings provide additional context for executions. Track changes before promoting to production.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="bg-background/60 text-xs">
                    {impactedNodeCount} impacted node{impactedNodeCount === 1 ? '' : 's'}
                  </Badge>
                  <span>Use the controls below to inspect specific change types.</span>
                </div>
                {diffData.connectionChanges.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Connection changes</p>
                        <p className="text-xs text-muted-foreground">
                          Highlighting edges that were added or removed between the selected versions.
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {diffData.connectionChanges.length} update{diffData.connectionChanges.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-lg border border-border/60 divide-y divide-border/50 bg-card/40">
                      {diffData.connectionChanges.map((conn) => (
                        <div
                          key={`${conn.edgeId}-${conn.type}-${conn.source}-${conn.target}`}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs capitalize',
                                conn.type === 'added'
                                  ? 'bg-green-500/15 text-green-600'
                                  : 'bg-red-500/15 text-red-600'
                              )}
                            >
                              {conn.type}
                            </span>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-mono text-xs truncate max-w-[120px]">{conn.source}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs truncate max-w-[120px]">{conn.target}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right min-w-[120px]">
                            <p>Output {conn.outputIndex ?? 0} → Target {conn.targetIndex ?? 0}</p>
                            {conn.connectionType && <p className="uppercase tracking-wide">{conn.connectionType}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diff View Tabs */}
                <Tabs defaultValue="canvas" className="mt-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="canvas" className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Canvas
                    </TabsTrigger>
                    <TabsTrigger value="visual" className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Cards
                    </TabsTrigger>
                    <TabsTrigger value="json" className="flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      JSON
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Canvas Diff Tab - n8n style */}
                  <TabsContent value="canvas" className="mt-4 space-y-4">
                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {DIFF_STATUS_OPTIONS.map((option) => {
                          const isActive = activeDiffStatuses.includes(option.key);
                          return (
                            <Button
                              key={option.key}
                              variant={isActive ? 'secondary' : 'ghost'}
                              size="sm"
                              className={cn(
                                'border text-xs font-medium',
                                isActive ? 'border-transparent shadow-sm' : 'border-border/60'
                              )}
                              onClick={() => toggleDiffStatus(option.key)}
                            >
                              <span className={cn('w-2 h-2 rounded-full mr-2', option.dotClass)} />
                              {option.label}
                            </Button>
                          );
                        })}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 text-xs text-muted-foreground"
                          onClick={resetDiffStatusFilters}
                        >
                          Reset
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            id="hide-unselected-nodes"
                            checked={hideUnselectedNodes}
                            onCheckedChange={(checked) => setHideUnselectedNodes(checked === true)}
                          />
                          Hide non-selected nodes
                        </label>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{visibleDiffStatuses.length}</span>
                          statuses highlighted
                        </span>
                      </div>
                    </div>
                    <WorkflowDiffCanvas
                      before={diffData.fromJson as { nodes?: { name: string; type: string; position: [number, number] }[]; connections?: Record<string, { main: Array<Array<{ node: string }>> }> }}
                      after={diffData.toJson as { nodes?: { name: string; type: string; position: [number, number] }[]; connections?: Record<string, { main: Array<Array<{ node: string }>> }> }}
                      nodeChanges={diffData.nodeChanges}
                      connectionChanges={diffData.connectionChanges}
                      visibleStatuses={visibleDiffStatuses}
                      hideUnselected={hideUnselectedNodes}
                      dimUnselected={!hideUnselectedNodes}
                    />
                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span>Added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span>Removed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span>Changed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-[2px] rounded-full bg-green-500" />
                        <span>Connection added</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-[2px] rounded-full bg-red-500 border border-dashed border-red-500" />
                        <span>Connection removed</span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Card-based Visual Diff Tab */}
                  <TabsContent value="visual" className="mt-4">
                    <VisualDiff 
                      nodeChanges={diffData.nodeChanges} 
                      summary={diffData.summary} 
                    />
                  </TabsContent>
                  
                  {/* JSON Diff Tab */}
                  <TabsContent value="json" className="mt-4 space-y-4">
                    <Tabs defaultValue="nodes">
                      <TabsList>
                        <TabsTrigger value="nodes">Nodes</TabsTrigger>
                        <TabsTrigger value="connections">Connections</TabsTrigger>
                        <TabsTrigger value="full">Full JSON</TabsTrigger>
                      </TabsList>
                      <TabsContent value="nodes" className="mt-4">
                        <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto max-h-[400px] font-mono">
                          {JSON.stringify((diffData.toJson as Record<string, unknown>).nodes, null, 2)}
                        </pre>
                      </TabsContent>
                      <TabsContent value="connections" className="mt-4">
                        <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto max-h-[400px] font-mono">
                          {JSON.stringify((diffData.toJson as Record<string, unknown>).connections, null, 2)}
                        </pre>
                      </TabsContent>
                      <TabsContent value="full" className="mt-4">
                        <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto max-h-[400px] font-mono">
                          {JSON.stringify(diffData.toJson, null, 2)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No differences found
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Variables & Execution History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Variables */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Variable className="w-4 h-4" />
                Variables
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowVariableDialog(true)}>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Store environment-specific values
            </p>
          </CardHeader>
          <CardContent>
            {workflow.variables.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No variables yet</p>
                <p className="text-xs mt-1">Add API URLs, keys, or other config</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workflow.variables.map(variable => (
                  <div
                    key={variable.id}
                    className="p-3 rounded-lg border border-border/50 bg-muted/20 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-medium">{variable.key}</code>
                          {variable.isSecret && (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono truncate">
                          {variable.value}
                        </p>
                        {variable.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {variable.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteVariable(variable.id)}
                        disabled={deletingVariableId === variable.id}
                      >
                        {deletingVariableId === variable.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution History & Errors */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <Tabs defaultValue="errors">
              <TabsList className="mb-4">
                <TabsTrigger value="errors" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Errors
                </TabsTrigger>
                <TabsTrigger value="executions" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Executions
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="errors">
                <ErrorTracker workflowId={workflowId} />
              </TabsContent>
              
              <TabsContent value="executions">
                <ExecutionHistory
                  executions={executions}
                  loading={loadingExecutions}
                  onSync={syncExecutions}
                  syncing={syncingExecutions}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Add Variable Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Targeted restore
            </DialogTitle>
            <DialogDescription>
              {restoreVersion
                ? `Apply selective changes from snapshot ${restoreVersion.hash}`
                : 'Select a version to restore.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={restoreMode} onValueChange={(value) => setRestoreMode(value as typeof restoreMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nodes">Nodes only</SelectItem>
                  <SelectItem value="singleNode">Specific nodes</SelectItem>
                  <SelectItem value="variables">Variables only</SelectItem>
                  <SelectItem value="full">Full rollback</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Nodes mode replaces the canvas but keeps settings. Full rollback mirrors the old version entirely.
              </p>
            </div>

            {(restoreMode === 'nodes' || restoreMode === 'singleNode') && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={restoreIncludeConnections}
                  onCheckedChange={(checked) => setRestoreIncludeConnections(checked === true)}
                />
                Include connections
              </label>
            )}

            {restoreMode === 'singleNode' && (
              <div className="space-y-2">
                <Label>Node names</Label>
                <Input
                  placeholder="nodeA, nodeB"
                  value={restoreNodesInput}
                  onChange={(e) => setRestoreNodesInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Provide comma-separated node names as they appear in n8n.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRestoreDialog(false)} disabled={restoring}>
              Cancel
            </Button>
            <Button onClick={handleTargetedRestore} disabled={restoring || !restoreVersion}>
              {restoring && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showVariableDialog} onOpenChange={setShowVariableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Variable</AlertDialogTitle>
            <AlertDialogDescription>
              Store a key-value pair for this workflow. Secrets are masked in the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="var-key">Key</Label>
              <Input
                id="var-key"
                placeholder="API_URL"
                value={newVariable.key}
                onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-value">Value</Label>
              <Input
                id="var-value"
                placeholder="https://api.example.com"
                type={newVariable.isSecret ? 'password' : 'text'}
                value={newVariable.value}
                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-desc">Description (optional)</Label>
              <Input
                id="var-desc"
                placeholder="The main API endpoint"
                value={newVariable.description}
                onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="var-secret"
                checked={newVariable.isSecret}
                onCheckedChange={(checked) => setNewVariable({ ...newVariable, isSecret: !!checked })}
              />
              <Label htmlFor="var-secret" className="text-sm font-normal">
                Mark as secret (value will be hidden)
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingVariable}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={addVariable} disabled={savingVariable || !newVariable.key}>
              {savingVariable ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Variable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote Dialog */}
      <AlertDialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Promote Workflow
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deploy this workflow to another environment. You can promote to the same or a different n8n instance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
              <div className="text-center">
                <span className={cn('inline-block w-2 h-2 rounded-full mb-1', currentEnv.color)} />
                <p className="text-xs font-medium">{currentEnv.label}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <span className={cn(
                  'inline-block w-2 h-2 rounded-full mb-1',
                  ENVIRONMENTS.find(e => e.value === promoteTarget.environment)?.color || 'bg-gray-500'
                )} />
                <p className="text-xs font-medium">
                  {ENVIRONMENTS.find(e => e.value === promoteTarget.environment)?.label}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Environment</Label>
              <Select
                value={promoteTarget.environment}
                onValueChange={(value) => setPromoteTarget({ ...promoteTarget, environment: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.filter(e => e.value !== workflow.environment).map(env => (
                    <SelectItem key={env.value} value={env.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', env.color)} />
                        {env.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Instance (optional)</Label>
              <Select
                value={promoteTarget.instanceId || 'same'}
                onValueChange={(value) => setPromoteTarget({ ...promoteTarget, instanceId: value === 'same' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Same instance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same instance ({workflow.instanceName})</SelectItem>
                  {instances
                    .filter(i => i.id !== workflow.instanceId)
                    .map(instance => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Promoting to a different instance will create a copy of this workflow there.
              </p>
            </div>

            {workflow.variables.length > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="copy-vars"
                  checked={promoteTarget.copyVariables}
                  onCheckedChange={(checked) => setPromoteTarget({ ...promoteTarget, copyVariables: !!checked })}
                />
                <Label htmlFor="copy-vars" className="text-sm font-normal">
                  Copy variables ({workflow.variables.length})
                </Label>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancel</AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={createPromotionRequest} disabled={creatingPromotion}>
                {creatingPromotion && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create promotion request
              </Button>
              <AlertDialogAction onClick={promoteWorkflow} disabled={promoting}>
                {promoting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                Promote now
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback confirmation dialog */}
      <AlertDialog open={!!rollbackVersion} onOpenChange={() => setRollbackVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback to version{' '}
              <code className="bg-muted px-1 py-0.5 rounded">{rollbackVersion?.hash}</code>?
              {rollbackVersion?.label && (
                <span className="block mt-1 text-muted-foreground">
                  {rollbackVersion.label}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {workflow.active && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This workflow is currently active. It will be updated immediately.</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollingBack}
              className="bg-primary"
            >
              {rollingBack ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
      {/* Promotion Requests Drawer */}
      <Drawer open={showPromotionDrawer} onOpenChange={setShowPromotionDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Promotion requests</DrawerTitle>
            <DrawerDescription>
              Track reviews, checklist status and approvals before deploying to another environment.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-auto space-y-4 py-4">
            {promotionRequests.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                No promotion requests yet. Create one from the Promote dialog.
              </div>
            ) : (
              promotionRequests.map((request) => (
                <div key={request.id} className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">#{request.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {request.targetEnvironment}
                      </p>
                    </div>
                    <Badge
                      variant={
                        request.status === 'approved'
                          ? 'success'
                          : request.status === 'rejected'
                          ? 'destructive'
                          : request.status === 'ready_for_review'
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {PROMOTION_STATUS_LABEL[request.status]}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {request.checklist.map((check) => (
                      <div key={check.key} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-2 h-2 rounded-full',
                              check.status === 'pass'
                                ? 'bg-success'
                                : check.status === 'fail'
                                ? 'bg-destructive'
                                : 'bg-muted-foreground'
                            )} />
                            <span className="font-medium">{check.label}</span>
                          </div>
                          {check.required && (
                            <span className="text-muted-foreground">Required</span>
                          )}
                        </div>
                        <Select
                          value={check.status}
                          onValueChange={(value) =>
                            handleChecklistUpdate(request.id, check.key, value as 'pending' | 'pass' | 'fail')
                          }
                          disabled={updatingChecklistId === request.id}
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CHECK_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  {request.status === 'ready_for_review' &&
                    request.checklist.some((check) => check.required && check.status !== 'pass') && (
                      <p className="text-xs text-warning">
                        Complete all required checks before approval.
                      </p>
                    )}
                  {request.notes && (
                    <p className="text-xs text-muted-foreground">Notes: {request.notes}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    {request.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updatingStatusId === request.id}
                        onClick={() => handlePromotionStatusChange(request.id, 'ready_for_review')}
                      >
                        {updatingStatusId === request.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : null}
                        Send for review
                      </Button>
                    )}
                    {request.status === 'ready_for_review' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingStatusId === request.id}
                          onClick={() => handlePromotionStatusChange(request.id, 'rejected')}
                        >
                          {updatingStatusId === request.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : null}
                          Reject
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          disabled={
                            updatingStatusId === request.id ||
                            request.checklist.some((check) => check.required && check.status !== 'pass')
                          }
                          onClick={() => handlePromotionStatusChange(request.id, 'approved')}
                        >
                          {updatingStatusId === request.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : null}
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
