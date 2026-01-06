'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  Webhook,
  Timer,
  Terminal,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

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

interface ExecutionHistoryProps {
  executions: Execution[];
  loading: boolean;
  onSync: () => void;
  syncing: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return CheckCircle;
    case 'error':
      return XCircle;
    case 'canceled':
      return AlertCircle;
    case 'waiting':
    case 'running':
      return Loader2;
    default:
      return Clock;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'success':
      return 'text-success';
    case 'error':
      return 'text-destructive';
    case 'canceled':
      return 'text-warning';
    case 'waiting':
    case 'running':
      return 'text-primary';
    default:
      return 'text-muted-foreground';
  }
}

function getModeIcon(mode: string) {
  switch (mode) {
    case 'manual':
      return Play;
    case 'webhook':
      return Webhook;
    case 'trigger':
    case 'cli':
      return Terminal;
    case 'retry':
      return RotateCcw;
    default:
      return Timer;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExecutionHistory({
  executions,
  loading,
  onSync,
  syncing,
}: ExecutionHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Execution History</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync from n8n
        </Button>
      </div>

      {executions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No executions yet</p>
          <p className="text-sm mt-1">
            Click &quot;Sync from n8n&quot; to fetch execution history
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {executions.map((execution) => {
            const StatusIcon = getStatusIcon(execution.status);
            const ModeIcon = getModeIcon(execution.mode);
            const isExpanded = expanded === execution.id;

            return (
              <div
                key={execution.id}
                className={cn(
                  'p-3 rounded-lg border transition-all cursor-pointer',
                  isExpanded ? 'bg-muted' : 'hover:bg-muted/50'
                )}
                onClick={() => setExpanded(isExpanded ? null : execution.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon
                      className={cn(
                        'w-5 h-5',
                        getStatusColor(execution.status),
                        execution.status === 'running' && 'animate-spin'
                      )}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            execution.status === 'success'
                              ? 'success'
                              : execution.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="capitalize"
                        >
                          {execution.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <ModeIcon className="w-3 h-3" />
                          {execution.mode}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(execution.startedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">
                      {formatDuration(execution.durationMs)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{execution.n8nExecutionId}
                    </p>
                  </div>
                </div>

                {/* Error details */}
                {isExpanded && execution.errorMessage && (
                  <div className="mt-3 p-3 rounded bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">Error</p>
                    <p className="text-sm text-destructive/80 mt-1 font-mono">
                      {execution.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats summary */}
      {executions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-success">
              {executions.filter((e) => e.status === 'success').length}
            </p>
            <p className="text-xs text-muted-foreground">Success</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">
              {executions.filter((e) => e.status === 'error').length}
            </p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {executions.length > 0
                ? formatDuration(
                    Math.round(
                      executions
                        .filter((e) => e.durationMs !== null)
                        .reduce((acc, e) => acc + (e.durationMs || 0), 0) /
                        executions.filter((e) => e.durationMs !== null).length
                    )
                  )
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </div>
        </div>
      )}
    </div>
  );
}



