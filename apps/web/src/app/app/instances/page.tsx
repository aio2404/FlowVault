'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';
import { useAuthStore, useToastStore } from '@/lib/store';
import { instanceApi, Environment, ENVIRONMENT_CONFIG, PlanSummary } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Server,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Loader2,
  ExternalLink,
  Wifi,
  WifiOff,
  MoreVertical,
  Webhook,
  Copy,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface Instance {
  id: string;
  name: string;
  baseUrl: string;
  status: string;
  lastSeenAt: string | null;
  webhookEnabled: boolean;
  webhookUrl: string | null;
  environment: Environment;
  envColor: string | null;
  createdAt: string;
}

interface PlanContext {
  plan: PlanSummary;
  limits: { instances: number; workflows: number };
  usage: { instances: number; workflows: number };
}

export default function InstancesPage() {
  const { token, currentOrgId } = useAuthStore();
  const { addToast } = useToastStore();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [planContext, setPlanContext] = useState<PlanContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', baseUrl: '', apiKey: '', environment: 'production' as Environment });
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [webhookLoadingId, setWebhookLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [limitModalData, setLimitModalData] = useState<{
    skipped: number;
    remaining: number;
  } | null>(null);

  const loadInstances = async () => {
    if (!token || !currentOrgId) return;

    try {
      const res = await instanceApi.list(token, currentOrgId);
      setInstances(res.instances);
      if (res.plan && res.limits && res.usage) {
        setPlanContext({
          plan: res.plan,
          limits: res.limits,
          usage: res.usage,
        });
      } else {
        setPlanContext(null);
      }
    } catch (error) {
      console.error('Failed to load instances:', error);
      addToast({ title: 'Failed to load instances', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, [token, currentOrgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentOrgId) return;

    setSubmitting(true);

    try {
      await instanceApi.create(token, currentOrgId, formData);
      addToast({ title: 'Instance added!', variant: 'success' });
      setDialogOpen(false);
      setFormData({ name: '', baseUrl: '', apiKey: '', environment: 'production' });
      loadInstances();
    } catch (error) {
      addToast({
        title: 'Failed to add instance',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (id: string) => {
    if (!token || !currentOrgId) return;

    setTestingId(id);

    try {
      const res = await instanceApi.test(token, currentOrgId, id);
      if (res.success) {
        addToast({ title: 'Connection successful!', variant: 'success' });
      } else {
        addToast({ title: 'Connection failed', description: res.error, variant: 'destructive' });
      }
      loadInstances();
    } catch (error) {
      addToast({
        title: 'Connection test failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleImport = async (id: string) => {
    if (!token || !currentOrgId) return;

    setImportingId(id);

    try {
      const res = await instanceApi.import(token, currentOrgId, id);
      if (res.limitReached) {
        setLimitModalData({
          skipped: res.skippedDueToLimit ?? 0,
          remaining: res.remainingWorkflowSlots ?? 0,
        });
        addToast({
          title: 'Workflow limit reached',
          description: 'Upgrade your plan to track more workflows.',
          variant: 'destructive',
        });
      } else {
        addToast({
          title: 'Workflows imported!',
          description: `${res.imported} new, ${res.updated} updated`,
          variant: 'success',
        });
      }
      loadInstances();
    } catch (error) {
      addToast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setImportingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !currentOrgId) return;
    if (!confirm('Delete this instance? All data will be lost.')) return;

    try {
      await instanceApi.delete(token, currentOrgId, id);
      addToast({ title: 'Instance deleted', variant: 'success' });
      loadInstances();
    } catch (error) {
      addToast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleToggleWebhook = async (instance: Instance) => {
    if (!token || !currentOrgId) return;
    setWebhookLoadingId(instance.id);

    try {
      if (instance.webhookEnabled) {
        await instanceApi.disableWebhook(token, currentOrgId, instance.id);
        addToast({ title: 'Webhook disabled', variant: 'success' });
      } else {
        const result = await instanceApi.enableWebhook(token, currentOrgId, instance.id);
        addToast({ title: 'Webhook enabled!', description: 'Copy the URL to configure in n8n', variant: 'success' });
      }
      loadInstances();
    } catch (error) {
      addToast({ title: 'Failed to update webhook', variant: 'destructive' });
    } finally {
      setWebhookLoadingId(null);
    }
  };

  const copyWebhookUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      addToast({ title: 'Webhook URL copied!', variant: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleChangeEnvironment = async (id: string, environment: Environment) => {
    if (!token || !currentOrgId) return;
    
    try {
      await instanceApi.update(token, currentOrgId, id, { environment });
      addToast({ title: `Environment changed to ${ENVIRONMENT_CONFIG[environment].label}`, variant: 'success' });
      loadInstances();
    } catch (error) {
      addToast({ title: 'Failed to change environment', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const instanceLimitReached =
    !!planContext && planContext.usage.instances >= planContext.limits.instances;

  return (
    <div className="space-y-6">
      {planContext && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary/80">
                {planContext.plan.name} plan
              </p>
              <p className="text-2xl font-semibold">
                {planContext.usage.instances}/{planContext.limits.instances} instances ·{' '}
                {planContext.usage.workflows}/{planContext.limits.workflows} workflows
              </p>
              {planContext.plan.renewsAt && (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(planContext.plan.renewsAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {instanceLimitReached && (
                <span className="text-xs font-medium text-destructive">
                  Instance limit reached
                </span>
              )}
              <Button variant="outline" asChild>
                <Link href="/app/billing">Manage plan</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-end gap-3">
        {instanceLimitReached && (
          <span className="text-sm text-muted-foreground hidden sm:block">
            Upgrade your plan to connect more instances.
          </span>
        )}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-8"
              disabled={instanceLimitReached}
              title={
                instanceLimitReached
                  ? 'Plan limit reached. Upgrade to add more instances.'
                  : undefined
              }
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add instance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect n8n instance</DialogTitle>
              <DialogDescription>
                Add your n8n instance to start tracking workflows
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">Name</Label>
                  <Input
                    id="name"
                    placeholder="My n8n"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseUrl" className="text-xs">URL</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    placeholder="https://n8n.example.com"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData((f) => ({ ...f, baseUrl: e.target.value }))}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-xs">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="n8n_api_..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData((f) => ({ ...f, apiKey: e.target.value }))}
                    required
                    className="h-9 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Settings → API in n8n
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="environment" className="text-xs">Environment</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ENVIRONMENT_CONFIG) as Environment[]).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, environment: env }))}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                          formData.environment === env
                            ? ENVIRONMENT_CONFIG[env].bgColor + ' ' + ENVIRONMENT_CONFIG[env].color
                            : 'border-border bg-background hover:bg-muted'
                        )}
                      >
                        {ENVIRONMENT_CONFIG[env].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {instances.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No instances"
          description="Connect your first n8n instance to start tracking"
          action={{
            label: 'Add instance',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => {
            const isConnected = instance.status === 'connected';
            
            return (
              <div 
                key={instance.id} 
                className="rounded border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded flex items-center justify-center',
                      isConnected ? 'bg-success/10' : 'bg-destructive/10'
                    )}>
                      {isConnected ? (
                        <Wifi className="w-5 h-5 text-success" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{instance.name}</h3>
                        <Badge variant={isConnected ? 'success' : 'destructive'} className="text-xs">
                          {isConnected ? 'Online' : 'Offline'}
                        </Badge>
                        {instance.webhookEnabled && (
                          <Badge variant="secondary" className="text-xs">
                            <Webhook className="w-3 h-3 mr-1" />
                            Webhook
                          </Badge>
                        )}
                        <span 
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded border',
                            ENVIRONMENT_CONFIG[instance.environment]?.bgColor || 'bg-muted',
                            ENVIRONMENT_CONFIG[instance.environment]?.color || 'text-muted-foreground'
                          )}
                        >
                          {ENVIRONMENT_CONFIG[instance.environment]?.label || instance.environment}
                        </span>
                      </div>
                      <a
                        href={instance.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        {instance.baseUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {instance.lastSeenAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last seen {formatRelativeTime(instance.lastSeenAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(instance.id)}
                      disabled={testingId === instance.id}
                      className="h-8"
                    >
                      {testingId === instance.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Test
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleImport(instance.id)}
                      disabled={importingId === instance.id}
                      className="h-8"
                    >
                      {importingId === instance.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Import
                        </>
                      )}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(instance.baseUrl, '_blank')}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in n8n
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleToggleWebhook(instance)}
                          disabled={webhookLoadingId === instance.id}
                        >
                          {webhookLoadingId === instance.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Webhook className="w-4 h-4 mr-2" />
                          )}
                          {instance.webhookEnabled ? 'Disable webhook' : 'Enable webhook'}
                        </DropdownMenuItem>
                        {instance.webhookEnabled && instance.webhookUrl && (
                          <DropdownMenuItem onClick={() => copyWebhookUrl(instance.id, instance.webhookUrl!)}>
                            {copiedId === instance.id ? (
                              <Check className="w-4 h-4 mr-2 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 mr-2" />
                            )}
                            Copy webhook URL
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Environment
                        </div>
                        {(Object.keys(ENVIRONMENT_CONFIG) as Environment[]).map((env) => (
                          <DropdownMenuItem
                            key={env}
                            onClick={() => handleChangeEnvironment(instance.id, env)}
                            className={cn(
                              instance.environment === env && 'bg-muted'
                            )}
                          >
                            <span className={cn(
                              'w-2 h-2 rounded-full mr-2',
                              env === 'production' && 'bg-red-500',
                              env === 'staging' && 'bg-yellow-500',
                              env === 'development' && 'bg-blue-500',
                              env === 'testing' && 'bg-purple-500',
                              env === 'custom' && 'bg-gray-500'
                            )} />
                            {ENVIRONMENT_CONFIG[env].label}
                            {instance.environment === env && (
                              <Check className="w-3 h-3 ml-auto" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(instance.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Webhook URL display */}
                {instance.webhookEnabled && instance.webhookUrl && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                      <Webhook className="w-3.5 h-3.5 text-primary shrink-0" />
                      <code className="flex-1 truncate text-muted-foreground font-mono">
                        {instance.webhookUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => copyWebhookUrl(instance.id, instance.webhookUrl!)}
                      >
                        {copiedId === instance.id ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog open={!!limitModalData} onOpenChange={(open) => {
        if (!open) setLimitModalData(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workflow limit reached</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve hit the maximum number of workflows allowed on your current plan.
              Upgrade to add more workflows or remove existing ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            {limitModalData && (
              <>
                <p>Skipped workflows: <span className="font-medium text-foreground">{limitModalData.skipped}</span></p>
                <p>Slots remaining: <span className="font-medium text-foreground">{Math.max(0, limitModalData.remaining)}</span></p>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLimitModalData(null)}>Close</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/app/billing">
                Upgrade plan
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
