'use client';

import { cn } from '@/lib/utils';
import { Plus, Minus, RefreshCw, ArrowRight, Zap, Mail, Globe, Database, MessageSquare, Clock, Code, FileText, Settings } from 'lucide-react';

interface NodeChange {
  type: 'added' | 'removed' | 'changed';
  nodeName: string;
  nodeType: string;
  details?: string[];
}

interface VisualDiffProps {
  nodeChanges: NodeChange[];
  summary: {
    nodesAdded: number;
    nodesRemoved: number;
    nodesChanged: number;
    connectionsChanged: boolean;
    settingsChanged: boolean;
  };
}

// Map node types to icons
function getNodeIcon(nodeType: string) {
  const type = nodeType.toLowerCase().replace('n8n-nodes-base.', '');
  
  if (type.includes('webhook') || type.includes('trigger')) return Zap;
  if (type.includes('email') || type.includes('mail')) return Mail;
  if (type.includes('http') || type.includes('request')) return Globe;
  if (type.includes('postgres') || type.includes('mysql') || type.includes('database') || type.includes('mongo')) return Database;
  if (type.includes('slack') || type.includes('discord') || type.includes('telegram')) return MessageSquare;
  if (type.includes('cron') || type.includes('schedule')) return Clock;
  if (type.includes('code') || type.includes('function')) return Code;
  if (type.includes('set') || type.includes('split')) return FileText;
  
  return Settings;
}

// Get a friendly name for the node type
function getNodeTypeName(nodeType: string) {
  return nodeType
    .replace('n8n-nodes-base.', '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

function NodeCard({ change }: { change: NodeChange }) {
  const Icon = getNodeIcon(change.nodeType);
  
  return (
    <div
      className={cn(
        'relative p-4 rounded-xl border-2 transition-all',
        change.type === 'added' && 'border-success bg-success/5 hover:bg-success/10',
        change.type === 'removed' && 'border-destructive bg-destructive/5 hover:bg-destructive/10',
        change.type === 'changed' && 'border-warning bg-warning/5 hover:bg-warning/10'
      )}
    >
      {/* Status badge */}
      <div
        className={cn(
          'absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center',
          change.type === 'added' && 'bg-success text-success-foreground',
          change.type === 'removed' && 'bg-destructive text-destructive-foreground',
          change.type === 'changed' && 'bg-warning text-warning-foreground'
        )}
      >
        {change.type === 'added' && <Plus className="w-4 h-4" />}
        {change.type === 'removed' && <Minus className="w-4 h-4" />}
        {change.type === 'changed' && <RefreshCw className="w-3 h-3" />}
      </div>

      {/* Node content */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            change.type === 'added' && 'bg-success/20 text-success',
            change.type === 'removed' && 'bg-destructive/20 text-destructive',
            change.type === 'changed' && 'bg-warning/20 text-warning'
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold truncate">{change.nodeName}</h4>
          <p className="text-sm text-muted-foreground truncate">
            {getNodeTypeName(change.nodeType)}
          </p>
          
          {/* Details for changed nodes */}
          {change.type === 'changed' && change.details && change.details.length > 0 && (
            <ul className="mt-2 space-y-1">
              {change.details.map((detail, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-warning" />
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function VisualDiff({ nodeChanges, summary }: VisualDiffProps) {
  const addedNodes = nodeChanges.filter((c) => c.type === 'added');
  const removedNodes = nodeChanges.filter((c) => c.type === 'removed');
  const changedNodes = nodeChanges.filter((c) => c.type === 'changed');

  const hasChanges = nodeChanges.length > 0 || summary.connectionsChanged || summary.settingsChanged;

  if (!hasChanges) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">No visual changes</p>
        <p className="text-sm">The workflows are identical</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Added nodes */}
      {addedNodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
              <Plus className="w-4 h-4 text-success-foreground" />
            </div>
            <h3 className="font-semibold text-success">
              Added ({addedNodes.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {addedNodes.map((change, i) => (
              <NodeCard key={i} change={change} />
            ))}
          </div>
        </div>
      )}

      {/* Changed nodes */}
      {changedNodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-warning flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-warning-foreground" />
            </div>
            <h3 className="font-semibold text-warning">
              Modified ({changedNodes.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {changedNodes.map((change, i) => (
              <NodeCard key={i} change={change} />
            ))}
          </div>
        </div>
      )}

      {/* Removed nodes */}
      {removedNodes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
              <Minus className="w-4 h-4 text-destructive-foreground" />
            </div>
            <h3 className="font-semibold text-destructive">
              Removed ({removedNodes.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {removedNodes.map((change, i) => (
              <NodeCard key={i} change={change} />
            ))}
          </div>
        </div>
      )}

      {/* Other changes */}
      {(summary.connectionsChanged || summary.settingsChanged) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Settings className="w-4 h-4 text-primary-foreground" />
            </div>
            <h3 className="font-semibold">Other Changes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.connectionsChanged && (
              <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Connections modified
              </div>
            )}
            {summary.settingsChanged && (
              <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Workflow settings changed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



