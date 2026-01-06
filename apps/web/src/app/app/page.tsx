'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { ActivityChart, generateActivityData } from '@/components/activity-chart';
import { useAuthStore, useToastStore } from '@/lib/store';
import { instanceApi, workflowApi, settingsApi } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { 
  Server, 
  GitBranch, 
  History, 
  Activity, 
  ArrowRight, 
  Clock, 
  ChevronRight,
  Zap,
  Plus,
  Camera,
  AlertTriangle,
  CheckCircle,
  Search,
  Command,
  RefreshCw,
  TrendingUp,
  Shield,
  Loader2,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';

interface Stats {
  instances: number;
  workflows: number;
  activeWorkflows: number;
  errorCount: number;
  versionsToday: number;
}

interface WorkflowListItem {
  id: string;
  name: string;
  instanceName: string;
  environment: string;
  lastSnapshot: string | null;
  active: boolean;
}

interface WorkflowError {
  id: string;
  workflowId: string;
  workflowName: string;
  instanceName: string;
  startedAt: string;
  severity: 'critical' | 'warning' | 'info';
  shortMessage: string;
}

interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  actor: { email: string; name: string | null } | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { token, currentOrgId, user } = useAuthStore();
  const { addToast } = useToastStore();
  const [stats, setStats] = useState<Stats>({ 
    instances: 0, 
    workflows: 0, 
    activeWorkflows: 0,
    errorCount: 0,
    versionsToday: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowListItem[]>([]);
  const [workflowErrors, setWorkflowErrors] = useState<WorkflowError[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotAll, setSnapshotAll] = useState(false);

  const handleSnapshotAll = async () => {
    if (!token || !currentOrgId) return;
    setSnapshotAll(true);
    try {
      const workflowsRes = await workflowApi.list(token, currentOrgId);
      let count = 0;
      for (const wf of workflowsRes.workflows.slice(0, 10)) {
        try {
          await workflowApi.snapshot(token, currentOrgId, wf.id);
          count++;
        } catch {
          // Continue with next
        }
      }
      addToast({ title: `${count} snapshots created`, variant: 'default' });
    } catch {
      addToast({ title: 'Snapshot failed', variant: 'destructive' });
    } finally {
      setSnapshotAll(false);
    }
  };

  useEffect(() => {
    async function loadDashboard() {
      if (!token || !currentOrgId) return;

      try {
        const [instancesRes, workflowsRes, logsRes, errorsRes] = await Promise.all([
          instanceApi.list(token, currentOrgId),
          workflowApi.list(token, currentOrgId),
          settingsApi.getAuditLogs(token, currentOrgId, { limit: 20 }),
          settingsApi.getGlobalErrors(token, currentOrgId, { limit: 100 }).catch(() => ({ errors: [] })),
        ]);

        const workflows = workflowsRes.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          instanceName: w.instanceName,
          environment: w.environment,
          lastSnapshot: w.lastSnapshot,
          active: w.active,
        }));
        const today = new Date().toDateString();
        const versionsToday = logsRes.logs.filter(
          l => l.action === 'workflow.snapshot' && new Date(l.createdAt).toDateString() === today
        ).length;
        
        setStats({
          instances: instancesRes.instances.length,
          workflows: workflows.length,
          activeWorkflows: workflows.filter(w => w.active).length,
          errorCount: errorsRes.errors?.length || 0,
          versionsToday,
        });

        setWorkflows(workflows);
        setRecentWorkflows(workflows.slice(0, 5));

        setRecentActivity(logsRes.logs.slice(0, 5));
        setWorkflowErrors(errorsRes.errors?.slice(0, 20) || []);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        addToast({
          title: 'Failed to load dashboard',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [token, currentOrgId, addToast]);

  const activityChartData = useMemo(
    () => generateActivityData(recentActivity),
    [recentActivity]
  );

  const activeAutomations = useMemo(
    () => workflows.filter((wf) => wf.active),
    [workflows]
  );

  const manualWorkflows = useMemo(
    () => workflows.filter((wf) => !wf.active),
    [workflows]
  );

  const attentionNeeded = useMemo(
    () => workflowErrors.slice(0, 4),
    [workflowErrors]
  );

  const formatAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      'workflow.imported': 'Imported workflows',
      'workflow.snapshot': 'Created snapshot',
      'workflow.rollback': 'Rolled back',
      'instance.created': 'Added instance',
      'instance.updated': 'Updated instance',
      'instance.deleted': 'Deleted instance',
      'instance.connected': 'Connected',
      'settings.updated': 'Updated settings',
    };
    return actionMap[action] || action;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome + Quick Actions */}
      <div className="flex items-start justify-between">
        <div className="fade-up">
          <h2 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Here&apos;s what&apos;s happening with your workflows
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSnapshotAll}
            disabled={snapshotAll || stats.workflows === 0}
            className="text-xs"
          >
            {snapshotAll ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5 mr-1.5" />
            )}
            Snapshot All
          </Button>
          <Link href="/app/instances">
            <Button variant="outline" size="sm" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Instance
            </Button>
          </Link>
        </div>
      </div>

      {/* Workflow health overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-border/60 bg-card/40">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-success" />
                  Active automations
                </p>
                <p className="text-xs text-muted-foreground">
                  Workflows scheduled to run automatically
                </p>
              </div>
              <Badge variant="secondary">{activeAutomations.length}</Badge>
            </div>
            {activeAutomations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflow is currently active. Enable auto-run inside each workflow.</p>
            ) : (
              <div className="space-y-3">
                {activeAutomations.slice(0, 4).map((wf) => (
                  <Link
                    key={wf.id}
                    href={`/app/workflows/${wf.id}`}
                    className="flex items-center justify-between rounded border border-border/40 p-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {wf.instanceName} · {wf.environment}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[10px] mb-1">Auto-run</Badge>
                      {wf.lastSnapshot && (
                        <p className="text-[11px] text-muted-foreground">
                          Snapshot {formatRelativeTime(wf.lastSnapshot)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/app/workflows" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage workflows <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <PauseCircle className="w-4 h-4 text-warning" />
                  Manual workflows
                </p>
                <p className="text-xs text-muted-foreground">
                  Drafts or workflows waiting for approval
                </p>
              </div>
              <Badge variant="secondary">{manualWorkflows.length}</Badge>
            </div>
            {manualWorkflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">All workflows are running automatically.</p>
            ) : (
              <div className="space-y-3">
                {manualWorkflows.slice(0, 4).map((wf) => (
                  <Link
                    key={wf.id}
                    href={`/app/workflows/${wf.id}`}
                    className="flex items-center justify-between rounded border border-border/40 p-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {wf.instanceName} · {wf.environment}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-warning border-warning/40">Manual</Badge>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/app/workflows?filter=manual" className="text-xs text-primary hover:underline flex items-center gap-1">
              Review drafts <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border border-border/60 bg-card/40">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Needs attention
                </p>
                <p className="text-xs text-muted-foreground">
                  Last 20 failed executions across instances
                </p>
              </div>
              <Badge variant="secondary">{workflowErrors.length}</Badge>
            </div>
            {attentionNeeded.length === 0 ? (
              <p className="text-sm text-muted-foreground">No errors in the last checks 🎉</p>
            ) : (
              <div className="space-y-3">
                {attentionNeeded.map((err) => (
                  <Link
                    key={err.id}
                    href={`/app/workflows/${err.workflowId}`}
                    className="flex items-center justify-between rounded border border-border/40 p-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{err.workflowName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {err.instanceName} · {formatRelativeTime(err.startedAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {err.shortMessage}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        err.severity === 'critical' && 'text-destructive border-destructive/40',
                        err.severity === 'warning' && 'text-warning border-warning/40'
                      )}
                    >
                      {err.severity}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/app/monitoring" className="text-xs text-primary hover:underline flex items-center gap-1">
              Open monitoring <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <OnboardingChecklist />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
        <Link href="/app/instances">
          <div className="metric-card p-4 rounded border border-border/50 bg-card/30 hover:bg-card/60 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                <Server className="w-4 h-4 text-primary" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold">{stats.instances}</p>
            <p className="text-xs text-muted-foreground">Instances</p>
          </div>
        </Link>

        <Link href="/app/workflows">
          <div className="metric-card p-4 rounded border border-border/50 bg-card/30 hover:bg-card/60 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded bg-success/10 flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-success" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold">{stats.workflows}</p>
            <p className="text-xs text-muted-foreground">Workflows</p>
          </div>
        </Link>

        <Link href="/app/monitoring">
          <div className="metric-card p-4 rounded border border-border/50 bg-card/30 hover:bg-card/60 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold">{stats.activeWorkflows}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </Link>

        <Link href="/app/monitoring">
          <div className="metric-card p-4 rounded border border-border/50 bg-card/30 hover:bg-card/60 cursor-pointer group">
            <div className="flex items-center justify-between mb-3">
              <div className={cn(
                "w-8 h-8 rounded flex items-center justify-center",
                stats.errorCount > 0 ? "bg-destructive/10" : "bg-muted"
              )}>
                <AlertTriangle className={cn(
                  "w-4 h-4",
                  stats.errorCount > 0 ? "text-destructive" : "text-muted-foreground"
                )} />
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              stats.errorCount > 0 && "text-destructive"
            )}>{stats.errorCount}</p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </Link>

        <div className="metric-card p-4 rounded border border-border/50 bg-card/30">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stats.versionsToday}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
      </div>

      {/* Health Status Banner */}
      {stats.errorCount > 0 && (
        <Link href="/app/monitoring">
          <div className="p-4 rounded border border-destructive/30 bg-destructive/5 flex items-center justify-between group hover:bg-destructive/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">
                  {stats.errorCount} workflow error{stats.errorCount !== 1 ? 's' : ''} detected
                </p>
                <p className="text-xs text-muted-foreground">
                  Click to view details and troubleshoot
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-destructive group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* Workflows */}
        <div className="col-span-3 rounded border border-border/50 bg-card/30">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <h3 className="font-semibold text-sm">Recent workflows</h3>
            <Link href="/app/workflows" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {recentWorkflows.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <GitBranch className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No workflows yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect an instance to get started
              </p>
              <Link href="/app/instances" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3">
                <Plus className="w-3 h-3" /> Add instance
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentWorkflows.map((workflow) => (
                <Link
                  key={workflow.id}
                  href={`/app/workflows/${workflow.id}`}
                  className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      workflow.active ? "bg-success" : "bg-muted-foreground"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{workflow.instanceName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {workflow.lastSnapshot && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(workflow.lastSnapshot)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="col-span-2 rounded border border-border/50 bg-card/30">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold text-sm">Recent activity</h3>
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <History className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Actions will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed">
                      <span className="font-medium">
                        {activity.actor?.name?.split(' ')[0] || activity.actor?.email?.split('@')[0] || 'System'}
                      </span>{' '}
                      <span className="text-muted-foreground">{formatAction(activity.action)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Chart */}
      <div className="rounded border border-border/50 bg-card/30 p-4">
        <h3 className="font-semibold text-sm mb-4">Activity (7 days)</h3>
        <ActivityChart data={activityChartData} />
      </div>
    </div>
  );
}
