import type { DiffSummary, NodeChange, N8nNode, ConnectionChange } from '@n8nback/shared';

interface WorkflowJson {
  nodes?: N8nNode[];
  connections?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ConnectionEntry {
  key: string;
  source: string;
  target: string;
  outputIndex: number;
  targetIndex: number;
  connectionType?: string;
}

function flattenConnections(workflow: WorkflowJson): ConnectionEntry[] {
  const entries: ConnectionEntry[] = [];
  const rawConnections = workflow.connections as
    | Record<string, { main?: Array<Array<{ node: string; type?: string }>> }>
    | undefined;

  if (!rawConnections) {
    return entries;
  }

  Object.entries(rawConnections).forEach(([sourceName, outputs]) => {
    const mainOutputs = outputs?.main;
    if (!Array.isArray(mainOutputs)) return;

    mainOutputs.forEach((connections, outputIndex) => {
      if (!Array.isArray(connections)) return;
      connections.forEach((conn, targetIndex) => {
        if (!conn || typeof conn !== 'object') return;
        const target = conn.node;
        if (!target) return;

        entries.push({
          key: `${sourceName}-${target}-${outputIndex}-${targetIndex}`,
          source: sourceName,
          target,
          outputIndex,
          targetIndex,
          connectionType: conn.type,
        });
      });
    });
  });

  return entries;
}

/**
 * Compute a node-level summary of changes between two workflow versions
 */
export function computeNodeSummary(
  oldJson: WorkflowJson,
  newJson: WorkflowJson
): DiffSummary {
  const oldNodes = oldJson.nodes || [];
  const newNodes = newJson.nodes || [];

  const oldNodeMap = new Map(oldNodes.map((n) => [n.id, n]));
  const newNodeMap = new Map(newNodes.map((n) => [n.id, n]));

  let nodesAdded = 0;
  let nodesRemoved = 0;
  let nodesChanged = 0;

  // Find added and changed nodes
  for (const [id, newNode] of newNodeMap) {
    const oldNode = oldNodeMap.get(id);
    if (!oldNode) {
      nodesAdded++;
    } else if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
      nodesChanged++;
    }
  }

  // Find removed nodes
  for (const id of oldNodeMap.keys()) {
    if (!newNodeMap.has(id)) {
      nodesRemoved++;
    }
  }

  // Check connections
  const connectionsChanged =
    JSON.stringify(oldJson.connections) !== JSON.stringify(newJson.connections);

  // Check settings
  const settingsChanged =
    JSON.stringify(oldJson.settings) !== JSON.stringify(newJson.settings);

  return {
    nodesAdded,
    nodesRemoved,
    nodesChanged,
    connectionsChanged,
    settingsChanged,
  };
}

/**
 * Get detailed node-level changes
 */
export function getNodeChanges(
  oldJson: WorkflowJson,
  newJson: WorkflowJson
): NodeChange[] {
  const oldNodes = oldJson.nodes || [];
  const newNodes = newJson.nodes || [];

  const oldNodeMap = new Map(oldNodes.map((n) => [n.id, n]));
  const newNodeMap = new Map(newNodes.map((n) => [n.id, n]));

  const changes: NodeChange[] = [];

  // Find added nodes
  for (const [id, newNode] of newNodeMap) {
    const oldNode = oldNodeMap.get(id);
    if (!oldNode) {
      changes.push({
        type: 'added',
        nodeName: newNode.name,
        nodeType: newNode.type,
      });
    } else if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
      const details: string[] = [];
      
      if (oldNode.name !== newNode.name) {
        details.push(`Name: "${oldNode.name}" → "${newNode.name}"`);
      }
      if (JSON.stringify(oldNode.parameters) !== JSON.stringify(newNode.parameters)) {
        details.push('Parameters changed');
      }
      if (JSON.stringify(oldNode.position) !== JSON.stringify(newNode.position)) {
        details.push('Position changed');
      }
      if (JSON.stringify(oldNode.credentials) !== JSON.stringify(newNode.credentials)) {
        details.push('Credentials changed');
      }

      changes.push({
        type: 'changed',
        nodeName: newNode.name,
        nodeType: newNode.type,
        details,
      });
    }
  }

  // Find removed nodes
  for (const [id, oldNode] of oldNodeMap) {
    if (!newNodeMap.has(id)) {
      changes.push({
        type: 'removed',
        nodeName: oldNode.name,
        nodeType: oldNode.type,
      });
    }
  }

  return changes;
}

/**
 * Compare workflow connections to see which edges were added/removed
 */
export function getConnectionChanges(
  oldJson: WorkflowJson,
  newJson: WorkflowJson
): ConnectionChange[] {
  const oldConnections = flattenConnections(oldJson);
  const newConnections = flattenConnections(newJson);

  const oldMap = new Map(oldConnections.map((conn) => [conn.key, conn]));
  const newMap = new Map(newConnections.map((conn) => [conn.key, conn]));

  const changes: ConnectionChange[] = [];

  // Added edges
  for (const conn of newConnections) {
    if (!oldMap.has(conn.key)) {
      changes.push({
        type: 'added',
        source: conn.source,
        target: conn.target,
        outputIndex: conn.outputIndex,
        targetIndex: conn.targetIndex,
        connectionType: conn.connectionType,
        edgeId: conn.key,
      });
    }
  }

  // Removed edges
  for (const conn of oldConnections) {
    if (!newMap.has(conn.key)) {
      changes.push({
        type: 'removed',
        source: conn.source,
        target: conn.target,
        outputIndex: conn.outputIndex,
        targetIndex: conn.targetIndex,
        connectionType: conn.connectionType,
        edgeId: conn.key,
      });
    }
  }

  return changes;
}


