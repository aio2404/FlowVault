'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { instanceApi, workflowApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Circle, Server, Download, History, ArrowRight } from 'lucide-react';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
}

export function OnboardingChecklist() {
  const { token, currentOrgId } = useAuthStore();
  const [steps, setSteps] = useState<ChecklistStep[]>([
    {
      id: 'connect',
      title: 'Connect n8n Instance',
      description: 'Add your first n8n instance to get started',
      icon: Server,
      href: '/app/instances',
      completed: false,
    },
    {
      id: 'import',
      title: 'Import Workflows',
      description: 'Import your workflows to start tracking versions',
      icon: Download,
      href: '/app/workflows',
      completed: false,
    },
    {
      id: 'version',
      title: 'View Versions & Rollback',
      description: 'View workflow history and rollback when needed',
      icon: History,
      href: '/app/workflows',
      completed: false,
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkProgress() {
      if (!token || !currentOrgId) return;

      try {
        const [instancesRes, workflowsRes] = await Promise.all([
          instanceApi.list(token, currentOrgId),
          workflowApi.list(token, currentOrgId),
        ]);

        setSteps((prev) => prev.map((step) => {
          if (step.id === 'connect' && instancesRes.instances.length > 0) {
            return { ...step, completed: true };
          }
          if (step.id === 'import' && workflowsRes.workflows.length > 0) {
            return { ...step, completed: true };
          }
          // Version step is considered complete if they have workflows with snapshots
          if (step.id === 'version') {
            const hasSnapshots = workflowsRes.workflows.some((w) => w.lastSnapshot);
            return { ...step, completed: hasSnapshots };
          }
          return step;
        }));
      } catch (error) {
        console.error('Failed to check onboarding progress:', error);
      } finally {
        setLoading(false);
      }
    }

    checkProgress();
  }, [token, currentOrgId]);

  const completedCount = steps.filter((s) => s.completed).length;
  const allCompleted = completedCount === steps.length;

  if (loading || allCompleted) {
    return null;
  }

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Getting Started</span>
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount} of {steps.length} completed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg transition-colors',
                step.completed
                  ? 'bg-success/10 text-success'
                  : 'bg-card hover:bg-muted'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  step.completed
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {step.completed ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium', step.completed && 'line-through opacity-60')}>
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {!step.completed && (
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}



