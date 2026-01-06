'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { useAuthStore, useToastStore } from '@/lib/store';
import { workflowApi, instanceApi, Environment, ENVIRONMENT_CONFIG } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { 
  GitBranch, 
  Search, 
  Clock, 
  ChevronRight, 
  Loader2, 
  Server, 
  Filter, 
  Camera, 
  AlertCircle,
  History,
  Zap,
  LayoutGrid,
  List
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  n8nWorkflowId: string;
  instanceId: string;
  instanceName: string;
  environment: Environment;
  active: boolean;
  lastSnapshot: string | null;
  versionCount?: number;
  errorCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Instance {
  id: string;
  name: string;
  environment: Environment;
}

export default function WorkflowsPage() {
  const { token, currentOrgId } = useAuthStore();
  const { addToast } = useToastStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [instanceFilter, setInstanceFilter] = useState<string>('all');
  const [envFilter, setEnvFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [snapshotting, setSnapshotting] = useState<string | null>(null);

  // Quick snapshot action
  const handleQuickSnapshot = async (e: React.MouseEvent, workflowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || !currentOrgId || snapshotting) return;
    
    setSnapshotting(workflowId);
    try {
      await workflowApi.snapshot(token, currentOrgId, workflowId);
      addToast({ title: 'Snapshot created', variant: 'default' });
      // Reload to update lastSnapshot
      const workflowsRes = await workflowApi.list(token, currentOrgId);
      setWorkflows(workflowsRes.workflows);
    } catch (error) {
      console.error('Snapshot failed:', error);
      addToast({ title: 'Snapshot failed', variant: 'destructive' });
    } finally {
      setSnapshotting(null);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!token || !currentOrgId) return;

      try {
        const [workflowsRes, instancesRes] = await Promise.all([
          workflowApi.list(token, currentOrgId),
          instanceApi.list(token, currentOrgId),
        ]);
        setWorkflows(workflowsRes.workflows);
        setInstances(instancesRes.instances.map((i) => ({ id: i.id, name: i.name, environment: i.environment })));
      } catch (error) {
        console.error('Failed to load workflows:', error);
        addToast({ title: 'Failed to load workflows', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [token, currentOrgId, addToast]);

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    const matchesInstance = instanceFilter === 'all' || w.instanceId === instanceFilter;
    const matchesEnv = envFilter === 'all' || w.environment === envFilter;
    return matchesSearch && matchesInstance && matchesEnv;
  });

  // Get unique environments from workflows
  const availableEnvs = Array.from(new Set(workflows.map(w => w.environment)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="No instances"
        description="Connect an n8n instance first to import workflows"
        action={{
          label: 'Add instance',
          onClick: () => (window.location.href = '/app/instances'),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-card/30"
          />
        </div>
        <Select value={instanceFilter} onValueChange={setInstanceFilter}>
          <SelectTrigger className="w-44 h-9 bg-card/30">
            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All instances" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instances</SelectItem>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-40 h-9 bg-card/30">
            <SelectValue placeholder="All environments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All environments</SelectItem>
            {availableEnvs.map((env) => (
              <SelectItem key={env} value={env}>
                <span className="flex items-center gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    env === 'production' && 'bg-red-500',
                    env === 'staging' && 'bg-yellow-500',
                    env === 'development' && 'bg-blue-500',
                    env === 'testing' && 'bg-purple-500',
                    env === 'custom' && 'bg-gray-500'
                  )} />
                  {ENVIRONMENT_CONFIG[env]?.label || env}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center border border-border/50 rounded-md overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-2.5 rounded-none border-0',
              viewMode === 'list' && 'bg-primary/10 text-primary'
            )}
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 px-2.5 rounded-none border-0',
              viewMode === 'grid' && 'bg-primary/10 text-primary'
            )}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span>{filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" />
          {filteredWorkflows.filter(w => w.active).length} active
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {instances.length} instance{instances.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Workflows */}
      {filteredWorkflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={search || instanceFilter !== 'all' || envFilter !== 'all' ? 'No results' : 'No workflows'}
          description={
            search || instanceFilter !== 'all' || envFilter !== 'all'
              ? 'Try different filters'
              : 'Import workflows from your instances'
          }
          action={
            !search && instanceFilter === 'all' && envFilter === 'all'
              ? {
                  label: 'Go to instances',
                  onClick: () => (window.location.href = '/app/instances'),
                }
              : undefined
          }
        />
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="rounded border border-border/50 bg-card/30 divide-y divide-border/50">
          {filteredWorkflows.map((workflow) => (
            <Link 
              key={workflow.id} 
              href={`/app/workflows/${workflow.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  workflow.active ? "bg-success" : "bg-muted-foreground"
                )} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium truncate">{workflow.name}</h3>
                    <Badge 
                      variant={workflow.active ? 'success' : 'secondary'} 
                      className="text-xs shrink-0"
                    >
                      {workflow.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="truncate">{workflow.instanceName}</span>
                    <span 
                      className={cn(
                        'px-1.5 py-0.5 text-xs font-medium rounded',
                        ENVIRONMENT_CONFIG[workflow.environment]?.bgColor || 'bg-muted',
                        ENVIRONMENT_CONFIG[workflow.environment]?.color || 'text-muted-foreground'
                      )}
                    >
                      {ENVIRONMENT_CONFIG[workflow.environment]?.label || workflow.environment}
                    </span>
                    {workflow.lastSnapshot && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(workflow.lastSnapshot)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleQuickSnapshot(e, workflow.id)}
                  disabled={snapshotting === workflow.id}
                >
                  {snapshotting === workflow.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </Button>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredWorkflows.map((workflow) => (
            <Link
              key={workflow.id}
              href={`/app/workflows/${workflow.id}`}
              className="group rounded-lg border border-border/50 bg-card/30 p-4 hover:border-primary/50 hover:bg-card/50 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  workflow.active ? "bg-success/10" : "bg-muted"
                )}>
                  <GitBranch className={cn(
                    "w-5 h-5",
                    workflow.active ? "text-success" : "text-muted-foreground"
                  )} />
                </div>
                <span 
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded',
                    ENVIRONMENT_CONFIG[workflow.environment]?.bgColor || 'bg-muted',
                    ENVIRONMENT_CONFIG[workflow.environment]?.color || 'text-muted-foreground'
                  )}
                >
                  {ENVIRONMENT_CONFIG[workflow.environment]?.label || workflow.environment}
                </span>
              </div>
              
              {/* Name */}
              <h3 className="font-medium truncate mb-1">{workflow.name}</h3>
              <p className="text-xs text-muted-foreground truncate mb-3">{workflow.instanceName}</p>
              
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {workflow.versionCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3" />
                    {workflow.versionCount}
                  </span>
                )}
                {workflow.lastSnapshot && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(workflow.lastSnapshot)}
                  </span>
                )}
              </div>
              
              {/* Quick action overlay */}
              <div className="mt-3 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={(e) => handleQuickSnapshot(e, workflow.id)}
                  disabled={snapshotting === workflow.id}
                >
                  {snapshotting === workflow.id ? (
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3 mr-1.5" />
                  )}
                  Quick Snapshot
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
