'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore, useToastStore } from '@/lib/store';
import { instanceApi, workflowApi, settingsApi } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Zap,
  GitBranch,
  ExternalLink,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertTriangle,
  Key,
  Globe,
  Clock,
  Lightbulb,
  Box,
} from 'lucide-react';
import Link from 'next/link';

interface Instance {
  id: string;
  name: string;
  baseUrl: string;
  status: string;
  lastSeenAt: string | null;
}

interface Workflow {
  id: string;
  name: string;
  instanceName: string;
  active: boolean;
}

interface GlobalError {
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
}

interface ErrorSummary {
  total: number;
  critical: number;
  warning: number;
  mostAffectedWorkflow: { id: string; name: string; count: number } | null;
}

interface IncidentEvent {
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
}

interface SlaMetrics {
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
}

export default function MonitoringPage() {
  const { token, currentOrgId } = useAuthStore();
  const { addToast } = useToastStore();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [errors, setErrors] = useState<GlobalError[]>([]);
  const [errorSummary, setErrorSummary] = useState<ErrorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingInstance, setTestingInstance] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<IncidentEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [slaMetrics, setSlaMetrics] = useState<SlaMetrics | null>(null);

  const loadData = async () => {
    if (!token || !currentOrgId) return;

    try {
      setTimelineLoading(true);
      const [instancesRes, workflowsRes, errorsRes, timelineRes, slaRes] = await Promise.all([
        instanceApi.list(token, currentOrgId),
        workflowApi.list(token, currentOrgId),
        settingsApi.getGlobalErrors(token, currentOrgId, { limit: 10 }),
        settingsApi.getIncidentTimeline(token, currentOrgId, { hours: 48, limit: 80 }),
        settingsApi.getSlaMetrics(token, currentOrgId, { hours: 24 }),
      ]);
      setInstances(instancesRes.instances);
      setWorkflows(workflowsRes.workflows.map(w => ({
        id: w.id,
        name: w.name,
        instanceName: w.instanceName,
        active: w.active,
      })));
      setErrors(errorsRes.errors);
      setErrorSummary(errorsRes.summary);
      setTimelineEvents(timelineRes.events);
      setSlaMetrics(slaRes);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
      addToast({ title: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, currentOrgId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    addToast({ title: 'Data refreshed', variant: 'success' });
  };

  const handleSyncAllExecutions = async () => {
    if (!token || !currentOrgId) return;
    setSyncing(true);
    try {
      const result = await settingsApi.syncAllExecutions(token, currentOrgId);
      addToast({
        title: `Synced ${result.totalSynced} executions`,
        description: `Found ${result.totalErrors} errors across ${result.results.length} instances`,
        variant: 'success',
      });
      // Reload errors after sync
      const errorsRes = await settingsApi.getGlobalErrors(token, currentOrgId, { limit: 10 });
      setErrors(errorsRes.errors);
      setErrorSummary(errorsRes.summary);
    } catch (error) {
      addToast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const testInstance = async (id: string) => {
    if (!token || !currentOrgId) return;
    setTestingInstance(id);
    try {
      const result = await instanceApi.test(token, currentOrgId, id);
      if (result.success) {
        addToast({ title: 'Connection successful!', variant: 'success' });
        loadData();
      } else {
        addToast({ title: 'Connection failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      addToast({ title: 'Test failed', variant: 'destructive' });
    } finally {
      setTestingInstance(null);
    }
  };

  const stats = useMemo(() => {
    const connectedInstances = instances.filter(i => i.status === 'connected').length;
    const activeWorkflows = workflows.filter(w => w.active).length;

    return {
      connectedInstances,
      disconnectedInstances: instances.length - connectedInstances,
      totalInstances: instances.length,
      activeWorkflows,
      inactiveWorkflows: workflows.length - activeWorkflows,
      totalWorkflows: workflows.length,
      healthScore: instances.length > 0 
        ? Math.round((connectedInstances / instances.length) * 100) 
        : 100,
    };
  }, [instances, workflows]);

  const slaSummary = useMemo(() => {
    if (!slaMetrics) {
      return {
        failureRate: 0,
        avgLatency: 0,
        executions: 0,
        breaches: 0,
      };
    }
    const executions = slaMetrics.totals.executions;
    const failureRate = executions > 0 ? slaMetrics.totals.errors / executions : 0;
    return {
      failureRate,
      avgLatency: slaMetrics.totals.avgDurationMs,
      executions,
      breaches: slaMetrics.breaches.length,
    };
  }, [slaMetrics]);

  const renderEventIcon = (event: IncidentEvent) => {
    if (event.type === 'execution_error') {
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
    if (event.type === 'deployment') {
      return <GitBranch className="w-4 h-4 text-primary" />;
    }
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const getHealthColor = (score: number) => {
    if (score === 100) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getHealthBg = (score: number) => {
    if (score === 100) return 'bg-success/10 border-success/30';
    if (score >= 50) return 'bg-warning/10 border-warning/30';
    return 'bg-destructive/10 border-destructive/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Monitoring</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de toutes vos instances n8n</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleSyncAllExecutions} 
            disabled={syncing}
            size="sm"
            className="h-8"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Zap className="w-3.5 h-3.5 mr-1.5" />
            )}
            {syncing ? 'Syncing...' : 'Sync Errors'}
          </Button>
          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="h-8"
          >
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Health Score */}
      <div className={cn(
        'p-5 rounded border',
        getHealthBg(stats.healthScore)
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded flex items-center justify-center',
              stats.healthScore === 100 ? 'bg-success/20' : 
              stats.healthScore >= 50 ? 'bg-warning/20' : 'bg-destructive/20'
            )}>
              {stats.healthScore === 100 ? (
                <CheckCircle2 className="w-6 h-6 text-success" />
              ) : stats.healthScore >= 50 ? (
                <AlertCircle className="w-6 h-6 text-warning" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">System Health</p>
              <p className={cn('text-3xl font-bold', getHealthColor(stats.healthScore))}>
                {stats.healthScore}%
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-success">{stats.connectedInstances}</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="font-bold text-destructive">{stats.disconnectedInstances}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-4 rounded border border-border/50 bg-card/30">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Instances</span>
          </div>
          <p className="text-xl font-bold">{stats.totalInstances}</p>
        </div>

        <div className="p-4 rounded border border-border/50 bg-card/30">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">Workflows</span>
          </div>
          <p className="text-xl font-bold">{stats.totalWorkflows}</p>
        </div>

        <div className="p-4 rounded border border-border/50 bg-card/30">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-xl font-bold">{stats.activeWorkflows}</p>
        </div>

        <div className="p-4 rounded border border-border/50 bg-card/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Inactive</span>
          </div>
          <p className="text-xl font-bold">{stats.inactiveWorkflows}</p>
        </div>
      </div>

      {/* SLA Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Real-time SLA
            </CardTitle>
            <CardDescription>
              Window {slaMetrics?.windowHours ?? 24}h · thresholds {slaMetrics?.thresholds.latencyMs ?? 5000}ms / {(slaMetrics?.thresholds.errorRate ?? 0.05) * 100}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Executions</p>
                <p className="text-2xl font-semibold">{slaSummary.executions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Failure rate</p>
                <p className={cn(
                  'text-2xl font-semibold',
                  slaSummary.failureRate > (slaMetrics?.thresholds.errorRate ?? 0.05)
                    ? 'text-destructive'
                    : 'text-success'
                )}>
                  {(slaSummary.failureRate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Avg latency</p>
                <p className="text-2xl font-semibold">{slaSummary.avgLatency}ms</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Alerts</p>
                <p className={cn(
                  'text-2xl font-semibold',
                  slaSummary.breaches > 0 ? 'text-warning' : 'text-success'
                )}>
                  {slaSummary.breaches}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              SLA breaches
            </CardTitle>
            <CardDescription>
              Workflows exceeding latency or error thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            {slaMetrics && slaMetrics.breaches.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-auto pr-2">
                {slaMetrics.breaches.map((breach) => (
                  <div
                    key={breach.workflowId}
                    className="p-3 rounded border border-border/50 bg-background/40"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{breach.workflowName}</p>
                        <p className="text-xs text-muted-foreground">{breach.instanceName ?? 'Unknown instance'}</p>
                      </div>
                      <Link
                        href={`/app/workflows/${breach.workflowId}`}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Inspect <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 text-xs mt-2">
                      <span className="text-destructive font-medium">
                        {(breach.errorRate * 100).toFixed(1)}% errors
                      </span>
                      <span className="text-muted-foreground">
                        p95 {breach.p95DurationMs}ms
                      </span>
                      <span className="text-muted-foreground">
                        {breach.totalExecutions} execs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No breaches detected 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instances */}
      <div className="rounded border border-border/50 bg-card/30">
        <div className="flex items-center gap-2 p-4 border-b border-border/50">
          <Server className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Instance Health</h3>
        </div>

        {instances.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Server className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No instances</p>
            <p className="text-xs text-muted-foreground mt-1">Add an instance to start monitoring</p>
            <Link href="/app/instances">
              <Button size="sm" variant="outline" className="mt-3 h-8">
                Add instance
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {instances.map((instance) => {
              const isConnected = instance.status === 'connected';
              
              return (
                <div
                  key={instance.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded flex items-center justify-center',
                      isConnected ? 'bg-success/10' : 'bg-destructive/10'
                    )}>
                      {isConnected ? (
                        <Wifi className="w-4 h-4 text-success" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{instance.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {instance.baseUrl}
                        <a 
                          href={instance.baseUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant={isConnected ? 'success' : 'destructive'} className="text-xs">
                        {isConnected ? 'Online' : 'Offline'}
                      </Badge>
                      {instance.lastSeenAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRelativeTime(instance.lastSeenAt)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testInstance(instance.id)}
                      disabled={testingInstance === instance.id}
                      className="h-8 px-2"
                    >
                      {testingInstance === instance.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {slaMetrics && slaMetrics.perInstance.length > 0 && (
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Instance SLA
            </CardTitle>
            <CardDescription>Latency & error trends per instance (last {slaMetrics.windowHours}h)</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="py-2 text-left">Instance</th>
                  <th className="py-2 text-right">Executions</th>
                  <th className="py-2 text-right">Failure rate</th>
                  <th className="py-2 text-right">Avg latency</th>
                </tr>
              </thead>
              <tbody>
                {slaMetrics.perInstance.map((instance) => (
                  <tr key={instance.instanceId} className="border-b border-border/20 last:border-0">
                    <td className="py-2">
                      <p className="font-medium">{instance.instanceName ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {instance.workflowsTracked} workflows
                      </p>
                    </td>
                    <td className="py-2 text-right">{instance.totalExecutions}</td>
                    <td className={cn(
                      'py-2 text-right font-medium',
                      instance.errorRate > (slaMetrics.thresholds.errorRate ?? 0.05)
                        ? 'text-destructive'
                        : 'text-success'
                    )}>
                      {(instance.errorRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 text-right">{instance.avgDurationMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout for Workflows and Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflows */}
        <div className="rounded border border-border/50 bg-card/30">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Workflows Status</h3>
            </div>
            <Link href="/app/workflows" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {workflows.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <GitBranch className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No workflows</p>
              <p className="text-xs text-muted-foreground mt-1">Import workflows from your instances</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-80 overflow-auto">
              {workflows.map((workflow) => (
                <Link
                  key={workflow.id}
                  href={`/app/workflows/${workflow.id}`}
                  className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      workflow.active ? 'bg-success' : 'bg-muted-foreground'
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{workflow.instanceName}</p>
                    </div>
                  </div>
                  <Badge variant={workflow.active ? 'success' : 'secondary'} className="text-xs shrink-0">
                    {workflow.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Errors */}
        <div className="rounded border border-border/50 bg-card/30">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-sm">Recent Errors</h3>
              {errorSummary && errorSummary.total > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {errorSummary.total}
                </Badge>
              )}
            </div>
          </div>

          {errors.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded bg-success/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <p className="text-sm font-medium">No recent errors</p>
              <p className="text-xs text-muted-foreground mt-1">All workflows are running smoothly</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-80 overflow-auto">
              {errors.map((error) => (
                <Link
                  key={error.id}
                  href={`/app/workflows/${error.workflowId}`}
                  className="block p-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded flex items-center justify-center shrink-0',
                      error.severity === 'critical' ? 'bg-destructive/10' :
                      error.severity === 'warning' ? 'bg-warning/10' : 'bg-muted'
                    )}>
                      {error.errorType === 'HTTPError' ? (
                        <Globe className={cn('w-4 h-4', error.severity === 'critical' ? 'text-destructive' : 'text-warning')} />
                      ) : error.errorType === 'CredentialError' || error.errorType === 'AuthenticationError' ? (
                        <Key className={cn('w-4 h-4', error.severity === 'critical' ? 'text-destructive' : 'text-warning')} />
                      ) : error.errorType === 'TimeoutError' ? (
                        <Clock className="w-4 h-4 text-warning" />
                      ) : (
                        <AlertCircle className={cn('w-4 h-4', error.severity === 'critical' ? 'text-destructive' : 'text-warning')} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge 
                          variant={error.severity === 'critical' ? 'destructive' : 'warning'} 
                          className="text-xs"
                        >
                          {error.errorType}
                        </Badge>
                        {error.nodeName && (
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Box className="w-3 h-3" />
                            {error.nodeName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">{error.shortMessage}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {error.workflowName} • {formatRelativeTime(error.startedAt)}
                      </p>
                      {error.suggestion && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <Lightbulb className="w-3 h-3 shrink-0 text-warning mt-0.5" />
                          <span>{error.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Error Summary */}
          {errorSummary && errorSummary.total > 0 && (
            <div className="p-4 border-t border-border/50 bg-muted/20">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-destructive font-medium">{errorSummary.critical} critical</span>
                  <span className="text-warning font-medium">{errorSummary.warning} warning</span>
                </div>
                {errorSummary.mostAffectedWorkflow && (
                  <span className="text-muted-foreground">
                    Most affected: <span className="font-medium">{errorSummary.mostAffectedWorkflow.name}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="border border-border/60 bg-card/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Incident timeline (48h)</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {timelineEvents.length} events
            </Badge>
          </div>
          <CardDescription>
            Failed executions, deployments and audit actions aligned on a single timeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune activité récente.
            </p>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-auto pr-2">
              {timelineEvents.slice(0, 40).map((event, index) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center border',
                        event.type === 'execution_error' ? 'bg-destructive/10 border-destructive/40' :
                        event.type === 'deployment' ? 'bg-primary/10 border-primary/40' :
                        'bg-muted/50 border-border/50'
                      )}
                    >
                      {renderEventIcon(event)}
                    </div>
                    {index < timelineEvents.length - 1 && (
                      <div className="flex-1 w-px bg-border mt-2" />
                    )}
                  </div>
                  <div className="flex-1 rounded-lg border border-border/40 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{event.title}</p>
                      {event.workflowName && (
                        <Badge variant="outline" className="text-xs">
                          {event.workflowName}
                        </Badge>
                      )}
                      {event.instanceName && (
                        <Badge variant="secondary" className="text-xs">
                          {event.instanceName}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                      <span className="font-mono">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                      {event.type === 'execution_error' && event.metadata?.errorType && (
                        <span className="flex items-center gap-1">
                          <Badge variant="destructive" className="text-[10px]">
                            {event.metadata.errorType as string}
                          </Badge>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
