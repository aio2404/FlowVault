import Fastify from 'fastify';

const app = Fastify({ logger: true });

// In-memory store for workflows
interface MockWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
  }>;
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
}

const workflows: Map<string, MockWorkflow> = new Map();

// Initialize with sample workflows
function initializeWorkflows() {
  const now = new Date().toISOString();

  workflows.set('wf-1', {
    id: 'wf-1',
    name: 'Customer Onboarding',
    active: true,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: 'node-1',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          path: 'onboarding',
          httpMethod: 'POST',
        },
      },
      {
        id: 'node-2',
        name: 'Send Welcome Email',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 2,
        position: [300, 200],
        parameters: {
          fromEmail: 'hello@company.com',
          subject: 'Welcome!',
          text: 'Thanks for signing up!',
        },
      },
      {
        id: 'node-3',
        name: 'Add to CRM',
        type: 'n8n-nodes-base.hubspot',
        typeVersion: 1,
        position: [500, 200],
        parameters: {
          operation: 'create',
          resource: 'contact',
        },
      },
    ],
    connections: {
      'Webhook Trigger': {
        main: [[{ node: 'Send Welcome Email', type: 'main', index: 0 }]],
      },
      'Send Welcome Email': {
        main: [[{ node: 'Add to CRM', type: 'main', index: 0 }]],
      },
    },
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
    },
  });

  workflows.set('wf-2', {
    id: 'wf-2',
    name: 'Slack Notifications',
    active: true,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: 'node-1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          rule: { interval: [{ field: 'hours', value: 1 }] },
        },
      },
      {
        id: 'node-2',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [300, 200],
        parameters: {
          url: 'https://api.example.com/stats',
          method: 'GET',
        },
      },
      {
        id: 'node-3',
        name: 'Slack',
        type: 'n8n-nodes-base.slack',
        typeVersion: 2,
        position: [500, 200],
        parameters: {
          operation: 'post',
          channel: '#alerts',
          text: 'Stats update',
        },
      },
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
      },
      'HTTP Request': {
        main: [[{ node: 'Slack', type: 'main', index: 0 }]],
      },
    },
    settings: {
      executionOrder: 'v1',
    },
  });

  workflows.set('wf-3', {
    id: 'wf-3',
    name: 'Data Sync Pipeline',
    active: false,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: 'node-1',
        name: 'Cron Trigger',
        type: 'n8n-nodes-base.cron',
        typeVersion: 1,
        position: [100, 200],
        parameters: {
          cronExpression: '0 */6 * * *',
        },
      },
      {
        id: 'node-2',
        name: 'Postgres',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2,
        position: [300, 200],
        parameters: {
          operation: 'executeQuery',
          query: 'SELECT * FROM users WHERE updated_at > NOW() - INTERVAL 6 hours',
        },
      },
      {
        id: 'node-3',
        name: 'Loop Over Items',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 2,
        position: [500, 200],
        parameters: {
          batchSize: 50,
        },
      },
      {
        id: 'node-4',
        name: 'Airtable',
        type: 'n8n-nodes-base.airtable',
        typeVersion: 1,
        position: [700, 200],
        parameters: {
          operation: 'upsert',
          table: 'Users',
        },
      },
    ],
    connections: {
      'Cron Trigger': {
        main: [[{ node: 'Postgres', type: 'main', index: 0 }]],
      },
      'Postgres': {
        main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]],
      },
      'Loop Over Items': {
        main: [[{ node: 'Airtable', type: 'main', index: 0 }]],
      },
    },
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: false,
    },
  });

  console.log(`Initialized ${workflows.size} mock workflows`);
}

// Auth middleware
app.addHook('preHandler', async (request, reply) => {
  // Skip auth for root
  if (request.url === '/') return;

  const apiKey = request.headers['x-n8n-api-key'];

  if (!apiKey) {
    return reply.status(401).send({ error: 'API key required' });
  }

  // Accept any non-empty API key for mock
  if (typeof apiKey !== 'string' || apiKey.length < 5) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }
});

// Root endpoint
app.get('/', async () => {
  return { name: 'Mock n8n API', version: '1.0.0' };
});

// List workflows
app.get('/api/v1/workflows', async () => {
  const data = Array.from(workflows.values()).map((wf) => ({
    id: wf.id,
    name: wf.name,
    active: wf.active,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  }));

  return { data };
});

// Get single workflow
app.get('/api/v1/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = workflows.get(id);

  if (!workflow) {
    return reply.status(404).send({ error: 'Workflow not found' });
  }

  return workflow;
});

// Update workflow
app.put('/api/v1/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<MockWorkflow>;

  const existing = workflows.get(id);

  if (!existing) {
    return reply.status(404).send({ error: 'Workflow not found' });
  }

  const updated: MockWorkflow = {
    ...existing,
    ...body,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
  };

  workflows.set(id, updated);

  console.log(`Updated workflow: ${id} - ${updated.name}`);

  return updated;
});

// Endpoint to simulate workflow changes (for testing)
app.post('/api/v1/simulate-change/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = workflows.get(id);

  if (!workflow) {
    return reply.status(404).send({ error: 'Workflow not found' });
  }

  // Add a random node to simulate a change
  const newNode = {
    id: `node-${Date.now()}`,
    name: `New Node ${Math.floor(Math.random() * 1000)}`,
    type: 'n8n-nodes-base.set',
    typeVersion: 1,
    position: [
      workflow.nodes[workflow.nodes.length - 1]?.position[0] ?? 100 + 200,
      workflow.nodes[workflow.nodes.length - 1]?.position[1] ?? 200,
    ] as [number, number],
    parameters: {
      values: {
        string: [{ name: 'timestamp', value: new Date().toISOString() }],
      },
    },
  };

  workflow.nodes.push(newNode);
  workflow.updatedAt = new Date().toISOString();

  console.log(`Simulated change on workflow: ${id} - added node ${newNode.name}`);

  return { success: true, addedNode: newNode.name };
});

// Start server
const port = parseInt(process.env.PORT || '5678');
const host = process.env.HOST || '0.0.0.0';

initializeWorkflows();

try {
  await app.listen({ port, host });
  console.log(`🎭 Mock n8n API running on http://${host}:${port}`);
  console.log(`\n📝 Available workflows:`);
  for (const [id, wf] of workflows) {
    console.log(`   - ${id}: ${wf.name} (${wf.active ? 'active' : 'inactive'})`);
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}



