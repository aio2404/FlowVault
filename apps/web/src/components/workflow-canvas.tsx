'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import {
  Zap,
  Globe,
  Mail,
  MessageSquare,
  Database,
  Code,
  Clock,
  Webhook,
  GitBranch,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';

// Map n8n node types to icons
const nodeIcons: Record<string, React.ElementType> = {
  'n8n-nodes-base.httpRequest': Globe,
  'n8n-nodes-base.slack': MessageSquare,
  'n8n-nodes-base.gmail': Mail,
  'n8n-nodes-base.postgres': Database,
  'n8n-nodes-base.mysql': Database,
  'n8n-nodes-base.mongodb': Database,
  'n8n-nodes-base.code': Code,
  'n8n-nodes-base.function': Code,
  'n8n-nodes-base.cron': Clock,
  'n8n-nodes-base.scheduleTrigger': Clock,
  'n8n-nodes-base.webhook': Webhook,
  'n8n-nodes-base.if': GitBranch,
  'n8n-nodes-base.switch': GitBranch,
  'n8n-nodes-base.start': Zap,
  'n8n-nodes-base.manualTrigger': Zap,
};

// Get icon for a node type
function getNodeIcon(type: string): React.ElementType {
  // Try exact match first
  if (nodeIcons[type]) return nodeIcons[type];
  
  // Try partial match
  const typeLower = type.toLowerCase();
  if (typeLower.includes('http') || typeLower.includes('request')) return Globe;
  if (typeLower.includes('slack') || typeLower.includes('discord') || typeLower.includes('telegram')) return MessageSquare;
  if (typeLower.includes('mail') || typeLower.includes('email')) return Mail;
  if (typeLower.includes('database') || typeLower.includes('sql') || typeLower.includes('mongo')) return Database;
  if (typeLower.includes('code') || typeLower.includes('function') || typeLower.includes('script')) return Code;
  if (typeLower.includes('cron') || typeLower.includes('schedule') || typeLower.includes('timer')) return Clock;
  if (typeLower.includes('webhook') || typeLower.includes('trigger')) return Webhook;
  if (typeLower.includes('if') || typeLower.includes('switch') || typeLower.includes('condition')) return GitBranch;
  
  return Zap; // Default
}

// Get color based on node type
function getNodeColor(type: string): string {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('trigger') || typeLower.includes('webhook') || typeLower.includes('start')) return 'border-green-500 bg-green-500/10';
  if (typeLower.includes('http') || typeLower.includes('request') || typeLower.includes('api')) return 'border-blue-500 bg-blue-500/10';
  if (typeLower.includes('slack') || typeLower.includes('discord') || typeLower.includes('telegram') || typeLower.includes('mail')) return 'border-purple-500 bg-purple-500/10';
  if (typeLower.includes('database') || typeLower.includes('sql') || typeLower.includes('mongo')) return 'border-orange-500 bg-orange-500/10';
  if (typeLower.includes('code') || typeLower.includes('function')) return 'border-yellow-500 bg-yellow-500/10';
  if (typeLower.includes('if') || typeLower.includes('switch')) return 'border-cyan-500 bg-cyan-500/10';
  return 'border-muted-foreground/30 bg-card';
}

// Change status for diff view
export type WorkflowChangeStatus = 'added' | 'removed' | 'changed' | 'unchanged';

interface WorkflowNodeData {
  label: string;
  type: string;
  changeStatus?: WorkflowChangeStatus;
  changes?: string[];
  isDimmed?: boolean;
}

// Custom node component
function WorkflowNode({ data }: { data: WorkflowNodeData }) {
  const Icon = getNodeIcon(data.type);
  const baseColor = getNodeColor(data.type);
  
  // Change status styling
  const statusStyles: Record<WorkflowChangeStatus, string> = {
    added: 'ring-2 ring-green-500 border-green-500 bg-green-500/20',
    removed: 'ring-2 ring-red-500 border-red-500 bg-red-500/20 opacity-60',
    changed: 'ring-2 ring-yellow-500 border-yellow-500 bg-yellow-500/20',
    unchanged: baseColor,
  };
  
  const statusIcons: Record<WorkflowChangeStatus, React.ElementType | null> = {
    added: Plus,
    removed: Minus,
    changed: RefreshCw,
    unchanged: null,
  };
  
  const status = data.changeStatus || 'unchanged';
  const StatusIcon = statusIcons[status];

  return (
    <div className={cn(
      'relative px-4 py-3 rounded-lg border-2 min-w-[140px] transition-all',
      statusStyles[status],
      data.isDimmed && 'opacity-30'
    )}>
      {/* Status indicator */}
      {StatusIcon && (
        <div className={cn(
          'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center',
          status === 'added' && 'bg-green-500',
          status === 'removed' && 'bg-red-500',
          status === 'changed' && 'bg-yellow-500',
        )}>
          <StatusIcon className="w-3 h-3 text-white" />
        </div>
      )}
      
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-background"
      />
      
      {/* Content */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-8 h-8 rounded flex items-center justify-center',
          status === 'unchanged' ? 'bg-background/50' : 'bg-background/80'
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className={cn(
            'text-sm font-medium truncate max-w-[120px]',
            status === 'removed' && 'line-through'
          )}>
            {data.label}
          </p>
          <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
            {data.type.split('.').pop()}
          </p>
        </div>
      </div>
      
      {/* Changes tooltip */}
      {data.changes && data.changes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">
            {data.changes.length} change{data.changes.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-background"
      />
    </div>
  );
}

const nodeTypes = {
  workflowNode: WorkflowNode,
};

interface N8nNode {
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
}

interface N8nConnection {
  [nodeName: string]: {
    main: Array<Array<{ node: string; type?: string; index?: number }>>;
  };
}

interface WorkflowCanvasProps {
  workflow: {
    nodes?: N8nNode[];
    connections?: N8nConnection;
  };
  // For diff view
  nodeChanges?: Array<{
    type: 'added' | 'removed' | 'changed';
    nodeName: string;
    nodeType: string;
    details?: string[];
  }>;
  className?: string;
  showMiniMap?: boolean;
  showControls?: boolean;
  visibleStatuses?: WorkflowChangeStatus[];
  hideUnselected?: boolean;
  dimUnselected?: boolean;
  connectionChanges?: Array<{
    type: 'added' | 'removed';
    source: string;
    target: string;
    outputIndex?: number;
    targetIndex?: number;
    edgeId?: string;
  }>;
}

export function WorkflowCanvas({
  workflow,
  nodeChanges,
  className,
  showMiniMap = true,
  showControls = true,
  visibleStatuses,
  hideUnselected = false,
  dimUnselected = false,
  connectionChanges,
}: WorkflowCanvasProps) {
  // Convert n8n workflow to React Flow format
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node<WorkflowNodeData>[] = [];
    const edges: Edge[] = [];
    
    if (!workflow.nodes) {
      return { initialNodes: nodes, initialEdges: edges };
    }
    
    // Create change status map
    const changeMap = new Map<string, { status: WorkflowChangeStatus; details?: string[] }>();
    if (nodeChanges) {
      nodeChanges.forEach((change) => {
        changeMap.set(change.nodeName, {
          status: change.type,
          details: change.details,
        });
      });
    }

    const visibleStatusSet = visibleStatuses ? new Set<WorkflowChangeStatus>(visibleStatuses) : null;
    const connectionChangeMap = new Map<string, 'added' | 'removed'>();
    if (connectionChanges) {
      connectionChanges.forEach((change) => {
        const key =
          change.edgeId ??
          `${change.source}-${change.target}-${change.outputIndex ?? 0}-${change.targetIndex ?? 0}`;
        connectionChangeMap.set(key, change.type);
      });
    }
    
    // Convert nodes
    workflow.nodes.forEach((node, index) => {
      const change = changeMap.get(node.name);
      const status = change?.status ?? 'unchanged';
      const isActive = !visibleStatusSet || visibleStatusSet.has(status);

      if (!isActive && hideUnselected && visibleStatusSet) {
        return;
      }
      
      nodes.push({
        id: node.name,
        type: 'workflowNode',
        position: {
          x: node.position?.[0] ?? index * 200,
          y: node.position?.[1] ?? 100,
        },
        data: {
          label: node.name,
          type: node.type,
          changeStatus: status,
          changes: change?.details,
          isDimmed: !isActive && !!visibleStatusSet && dimUnselected,
        },
      });
    });
    
    const includedNodeIds = new Set(nodes.map((node) => node.id));

    // Convert connections
    if (workflow.connections) {
      Object.entries(workflow.connections).forEach(([sourceName, outputs]) => {
        if (outputs.main) {
          outputs.main.forEach((connections, outputIndex) => {
            connections?.forEach((conn, connIndex) => {
              if (!conn?.node) return;
              if (!includedNodeIds.has(sourceName) || !includedNodeIds.has(conn.node)) {
                return;
              }
              edges.push({
                id: `${sourceName}-${conn.node}-${outputIndex}-${connIndex}`,
                source: sourceName,
                target: conn.node,
                type: 'smoothstep',
                animated: true,
                style: (() => {
                  const key = `${sourceName}-${conn?.node}-${outputIndex}-${connIndex}`;
                  const status = connectionChangeMap.get(key);
                  const baseColor = 'hsl(var(--muted-foreground))';
                  const addedColor = 'rgb(34, 197, 94)';
                  const removedColor = 'rgb(239, 68, 68)';
                  if (status === 'added') {
                    return { stroke: addedColor, strokeWidth: 3 };
                  }
                  if (status === 'removed') {
                    return {
                      stroke: removedColor,
                      strokeWidth: 3,
                      strokeDasharray: '6 4',
                    };
                  }
                  return { stroke: baseColor, strokeWidth: 2, opacity: dimUnselected && visibleStatusSet ? 0.4 : 1 };
                })(),
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: (() => {
                    const key = `${sourceName}-${conn?.node}-${outputIndex}-${connIndex}`;
                    const status = connectionChangeMap.get(key);
                    if (status === 'added') return 'rgb(34, 197, 94)';
                    if (status === 'removed') return 'rgb(239, 68, 68)';
                    return 'hsl(var(--muted-foreground))';
                  })(),
                },
              });
            });
          });
        }
      });
    }
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [workflow, nodeChanges, visibleStatuses, hideUnselected, dimUnselected, connectionChanges]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className={cn('w-full h-[400px] rounded-lg overflow-hidden bg-background/50 border border-border/50', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="workflow-canvas"
      >
        <Background color="hsl(var(--muted-foreground))" gap={20} size={1} />
        {showControls && (
          <Controls className="!bg-card !border-border/50 !rounded-lg !shadow-lg" />
        )}
        {showMiniMap && (
          <MiniMap
            className="!bg-card !border-border/50 !rounded-lg"
            nodeColor={(node) => {
              const data = node.data as WorkflowNodeData;
              if (data.changeStatus === 'added') return 'rgb(34, 197, 94)';
              if (data.changeStatus === 'removed') return 'rgb(239, 68, 68)';
              if (data.changeStatus === 'changed') return 'rgb(234, 179, 8)';
              return 'hsl(var(--muted-foreground))';
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

// Side-by-side diff view
interface WorkflowDiffCanvasProps {
  before: {
    nodes?: N8nNode[];
    connections?: N8nConnection;
  };
  after: {
    nodes?: N8nNode[];
    connections?: N8nConnection;
  };
  nodeChanges?: Array<{
    type: 'added' | 'removed' | 'changed';
    nodeName: string;
    nodeType: string;
    details?: string[];
  }>;
  className?: string;
  connectionChanges?: Array<{
    type: 'added' | 'removed';
    source: string;
    target: string;
    outputIndex?: number;
    targetIndex?: number;
    edgeId?: string;
  }>;
  visibleStatuses?: WorkflowChangeStatus[];
  hideUnselected?: boolean;
  dimUnselected?: boolean;
}

export function WorkflowDiffCanvas({
  before,
  after,
  nodeChanges,
  className,
  connectionChanges,
  visibleStatuses,
  hideUnselected,
  dimUnselected,
}: WorkflowDiffCanvasProps) {
  // For the "before" view, mark removed nodes
  const beforeChanges = nodeChanges?.filter(c => c.type === 'removed' || c.type === 'changed');
  // For the "after" view, mark added and changed nodes
  const afterChanges = nodeChanges?.filter(c => c.type === 'added' || c.type === 'changed');
  const beforeEdgeChanges = connectionChanges?.filter((c) => c.type === 'removed');
  const afterEdgeChanges = connectionChanges?.filter((c) => c.type === 'added');

  return (
    <div className={cn('grid grid-cols-2 gap-4', className)}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Before</span>
        </div>
        <WorkflowCanvas
          workflow={before}
          nodeChanges={beforeChanges}
          showMiniMap
          showControls
          className="h-[360px]"
          visibleStatuses={visibleStatuses}
          hideUnselected={hideUnselected}
          dimUnselected={dimUnselected}
          connectionChanges={beforeEdgeChanges}
        />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-medium text-muted-foreground">After</span>
        </div>
        <WorkflowCanvas
          workflow={after}
          nodeChanges={afterChanges}
          showMiniMap
          showControls
          className="h-[360px]"
          visibleStatuses={visibleStatuses}
          hideUnselected={hideUnselected}
          dimUnselected={dimUnselected}
          connectionChanges={afterEdgeChanges}
        />
      </div>
    </div>
  );
}
