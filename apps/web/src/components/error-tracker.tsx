'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Key,
  Globe,
  WifiOff,
  Clock,
  Gauge,
  Shield,
  Code,
  FileWarning,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Box,
  Filter,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAuthStore, useToastStore } from '@/lib/store';
import { workflowApi } from '@/lib/api';

interface ParsedError {
  id: string;
  executionId: string;
  startedAt: string;
  nodeName: string | null;
  nodeType: string | null;
  errorType: string;
  shortMessage: string;
  fullMessage: string;
  suggestion: string | null;
  severity: 'critical' | 'warning' | 'info';
}

interface ErrorSummary {
  total: number;
  byType: Record<string, number>;
  mostProblematicNode: { name: string; count: number } | null;
}

interface ErrorTrackerProps {
  workflowId: string;
}

const ERROR_ICONS: Record<string, typeof AlertCircle> = {
  HTTPError: Globe,
  NodeOperationError: AlertCircle,
  CredentialError: Key,
  ConnectionError: WifiOff,
  ValidationError: FileWarning,
  ExpressionError: Code,
  TimeoutError: Clock,
  RateLimitError: Gauge,
  AuthenticationError: Shield,
  Unknown: AlertTriangle,
};

const SEVERITY_COLORS = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  info: 'bg-muted text-muted-foreground border-border',
};

const SEVERITY_BADGE_COLORS = {
  critical: 'destructive',
  warning: 'warning',
  info: 'secondary',
} as const;

export function ErrorTracker({ workflowId }: ErrorTrackerProps) {
  const { token, currentOrgId } = useAuthStore();
  const { addToast } = useToastStore();
  const [errors, setErrors] = useState<ParsedError[]>([]);
  const [summary, setSummary] = useState<ErrorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const loadErrors = async () => {
    if (!token || !currentOrgId) return;

    try {
      const result = await workflowApi.getErrors(token, currentOrgId, workflowId, {
        limit: 50,
        errorType: filterType || undefined,
      });
      setErrors(result.errors);
      setSummary(result.summary);
    } catch (error) {
      console.error('Failed to load errors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
  }, [token, currentOrgId, workflowId, filterType]);

  const handleSync = async () => {
    if (!token || !currentOrgId) return;
    setSyncing(true);

    try {
      await workflowApi.syncExecutions(token, currentOrgId, workflowId);
      await loadErrors();
      addToast({ title: 'Errors synced', variant: 'success' });
    } catch (error) {
      addToast({ title: 'Failed to sync', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const getIcon = (errorType: string) => {
    const Icon = ERROR_ICONS[errorType] || ERROR_ICONS.Unknown;
    return Icon;
  };

  if (loading) {
    return (
      <Card className="bg-card/30 border-border/50">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && summary.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Errors */}
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Errors</p>
                  <p className="text-2xl font-bold text-destructive">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Most Common Error Type */}
          {Object.keys(summary.byType).length > 0 && (
            <Card className="bg-warning/5 border-warning/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Most Common</p>
                    <p className="text-lg font-semibold">
                      {Object.entries(summary.byType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Problematic Node */}
          {summary.mostProblematicNode && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Box className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Problem Node</p>
                    <p className="text-lg font-semibold truncate" title={summary.mostProblematicNode.name}>
                      {summary.mostProblematicNode.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{summary.mostProblematicNode.count} errors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error Type Filters */}
      {summary && Object.keys(summary.byType).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Button
            variant={filterType === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(null)}
            className="h-7 text-xs"
          >
            All ({summary.total})
          </Button>
          {Object.entries(summary.byType).map(([type, count]) => {
            const Icon = getIcon(type);
            return (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type)}
                className="h-7 text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {type} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* Error List */}
      <Card className="bg-card/30 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Recent Errors
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-8"
            >
              {syncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Sync
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No errors found</p>
              <p className="text-sm text-muted-foreground/70">
                {filterType ? `No ${filterType} errors recorded` : 'This workflow has no recorded errors'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {errors.map((error) => {
                const Icon = getIcon(error.errorType);
                const isExpanded = expandedId === error.id;

                return (
                  <div
                    key={error.id}
                    className={cn(
                      'rounded-md border p-4 transition-all',
                      SEVERITY_COLORS[error.severity]
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={SEVERITY_BADGE_COLORS[error.severity]} className="text-xs">
                            {error.errorType}
                          </Badge>
                          {error.nodeName && (
                            <Badge variant="outline" className="text-xs font-mono">
                              <Box className="w-3 h-3 mr-1" />
                              {error.nodeName}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(error.startedAt)}
                          </span>
                        </div>

                        <p className="font-medium text-sm">{error.shortMessage}</p>

                        {error.suggestion && (
                          <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-background/50 rounded p-2">
                            <Lightbulb className="w-4 h-4 shrink-0 text-warning" />
                            <span>{error.suggestion}</span>
                          </div>
                        )}

                        {/* Expandable full error */}
                        {error.fullMessage !== error.shortMessage && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : error.id)}
                              className="h-6 text-xs p-0 hover:bg-transparent"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3 mr-1" />
                                  Hide details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  Show full error
                                </>
                              )}
                            </Button>

                            {isExpanded && (
                              <pre className="mt-2 p-3 bg-background/50 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words border border-border/50">
                                {error.fullMessage}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



