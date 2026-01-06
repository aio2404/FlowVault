'use client';

import { useEffect, useState } from 'react';
import { billingApi, type PlanSummary, ApiError } from '@/lib/api';
import { useAuthStore, useToastStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillingData {
  plan: PlanSummary & { renewsAt: string | null };
  usage: { instances: number; workflows: number };
  limits: { instances: number; workflows: number };
  availablePlans: PlanSummary[];
}

interface UsageDetails {
  plan: PlanSummary & { renewsAt: string | null };
  usage: { instances: number; workflows: number };
  limits: { instances: number; workflows: number };
  estimatedMonthlyCost: { amount: number; currency: string };
  costHistory: Array<{
    month: string;
    amount: number;
    currency: string;
    instances: number;
    workflows: number;
  }>;
  instanceUsage: Array<{
    id: string;
    name: string;
    baseUrl: string;
    environment: string;
    workflowCount: number;
    createdAt: string;
    lastSeenAt: string | null;
  }>;
  workflowUsage: Array<{
    id: string;
    name: string;
    instanceName: string;
    versionCount: number;
    executionCount: number;
    lastSnapshotAt: string | null;
    updatedAt: string;
  }>;
}

export default function BillingPage() {
  const { token, currentOrgId, organizations } = useAuthStore();
  const { addToast } = useToastStore();
  const [data, setData] = useState<BillingData | null>(null);
  const [usageDetails, setUsageDetails] = useState<UsageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const isOwner = currentOrg?.role === 'owner';

  const fetchBilling = async () => {
    if (!token || !currentOrgId) return;
    setLoading(true);
    setUsageLoading(true);
    try {
      const [planRes, usageRes] = await Promise.all([
        billingApi.getPlan(token, currentOrgId),
        billingApi.usage(token, currentOrgId),
      ]);
      setData(planRes);
      setUsageDetails(usageRes);
    } catch (error) {
      console.error('Failed to load billing plan', error);
      addToast({ title: 'Failed to load billing info', variant: 'destructive' });
    } finally {
      setLoading(false);
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, [token, currentOrgId]);

  const handleChangePlan = async (planId: string) => {
    if (!token || !currentOrgId) return;
    setChangingPlanId(planId);
    try {
      await billingApi.changePlan(token, currentOrgId, planId);
      addToast({ title: 'Plan updated', variant: 'success' });
      fetchBilling();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Unable to change plan right now.';
      addToast({ title: 'Plan change failed', description: message, variant: 'destructive' });
    } finally {
      setChangingPlanId(null);
    }
  };

  if (!token || !currentOrgId) {
    return null;
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const usageCopy = `${data.usage.instances}/${data.limits.instances} instances · ${data.usage.workflows}/${data.limits.workflows} workflows`;

  const handleDownloadCsv = () => {
    if (!token || !currentOrgId) return;
    billingApi.downloadUsageCsv(token, currentOrgId).catch(() => {
      addToast({ title: 'Failed to download CSV', variant: 'destructive' });
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{data.plan.name} plan</CardTitle>
              <CardDescription>
                {data.plan.price === 0 ? 'Free forever' : `$${data.plan.price}/month`} · {usageCopy}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Instances</p>
            <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (data.usage.instances / data.limits.instances) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Workflows</p>
            <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/70 transition-all"
                style={{
                  width: `${Math.min(100, (data.usage.workflows / data.limits.workflows) * 100)}%`,
                }}
              />
            </div>
          </div>
          {data.plan.renewsAt && (
            <p className="text-xs text-muted-foreground">
              Next renewal on {new Date(data.plan.renewsAt).toLocaleDateString()}
            </p>
          )}
          {!isOwner && (
            <p className="text-xs text-muted-foreground">
              Only organization owners can change the plan.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        {data.availablePlans.map((plan) => {
          const isCurrent = plan.id === data.plan.id;
          const isUpgrade = plan.price > data.plan.price;
          const actionLabel = isCurrent ? 'Current plan' : isUpgrade ? 'Upgrade' : 'Downgrade';
          const disabled = isCurrent || !isOwner;

          return (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col border-border/60',
                isCurrent && 'border-primary'
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && (
                    <span className="text-xs font-medium text-primary">Current</span>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div>
                  <p className="text-3xl font-semibold">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.instanceLimit} instances · {plan.workflowLimit} workflows
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'secondary' : 'default'}
                  disabled={disabled || changingPlanId === plan.id}
                  onClick={() => handleChangePlan(plan.id)}
                >
                  {changingPlanId === plan.id && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {actionLabel}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detailed usage</CardTitle>
              <CardDescription>Breakdown by instance and workflow</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDownloadCsv}>
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {usageLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : usageDetails ? (
            <>
              {usageDetails.costHistory.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Cost history
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Last {usageDetails.costHistory.length} month(s)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[600px] gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {usageDetails.costHistory.map((entry) => {
                        const monthLabel = new Date(entry.month).toLocaleDateString(undefined, {
                          month: 'short',
                          year: 'numeric',
                        });
                        return (
                          <div
                            key={entry.month}
                            className="p-4 rounded-lg border border-border/60 bg-background/50"
                          >
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              {monthLabel}
                            </p>
                            <p className="text-xl font-semibold">
                              {entry.currency === 'USD' ? '$' : ''}
                              {entry.amount.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.instances} inst · {entry.workflows} wf
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-4">
                  <p className="text-sm text-muted-foreground">Estimated monthly cost</p>
                  <p className="text-2xl font-semibold">
                    {usageDetails.estimatedMonthlyCost.currency === 'USD' ? '$' : ''}
                    {usageDetails.estimatedMonthlyCost.amount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on current plan ({usageDetails.plan.name})
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-4">
                  <p className="text-sm text-muted-foreground">Usage snapshot</p>
                  <p className="text-lg font-medium">
                    {usageDetails.usage.instances}/{usageDetails.limits.instances} instances ·{' '}
                    {usageDetails.usage.workflows}/{usageDetails.limits.workflows} workflows
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Instances
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {usageDetails.instanceUsage.length} connected
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Environment</th>
                        <th className="px-4 py-3 font-medium">Workflows</th>
                        <th className="px-4 py-3 font-medium">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageDetails.instanceUsage.map((instance) => (
                        <tr key={instance.id} className="border-t border-border/60">
                          <td className="px-4 py-3">
                            <p className="font-medium">{instance.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {instance.baseUrl}
                            </p>
                          </td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">
                            {instance.environment}
                          </td>
                          <td className="px-4 py-3">{instance.workflowCount}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {instance.lastSeenAt
                              ? new Date(instance.lastSeenAt).toLocaleString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Workflows
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {usageDetails.workflowUsage.length} tracked
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Workflow</th>
                        <th className="px-4 py-3 font-medium">Instance</th>
                        <th className="px-4 py-3 font-medium">Versions</th>
                        <th className="px-4 py-3 font-medium">Executions</th>
                        <th className="px-4 py-3 font-medium">Last snapshot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageDetails.workflowUsage.map((workflow) => (
                        <tr key={workflow.id} className="border-t border-border/60">
                          <td className="px-4 py-3 font-medium">{workflow.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{workflow.instanceName}</td>
                          <td className="px-4 py-3">{workflow.versionCount}</td>
                          <td className="px-4 py-3">{workflow.executionCount}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {workflow.lastSnapshotAt
                              ? new Date(workflow.lastSnapshotAt).toLocaleString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Usage data unavailable. Try refreshing the page.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
