import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { authRoutes } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { instanceRoutes } from './routes/instances.js';
import { workflowRoutes } from './routes/workflows.js';
import { settingsRoutes } from './routes/settings.js';
import { webhookRoutes } from './routes/webhooks.js';
import { billingRoutes } from './routes/billing.js';

const app = Fastify({
  logger: true,
});

// Plugins
await app.register(cors, {
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(sensible);

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
await app.register(authRoutes);
await app.register(organizationRoutes);
await app.register(instanceRoutes);
await app.register(workflowRoutes);
await app.register(settingsRoutes);
await app.register(billingRoutes);
await app.register(webhookRoutes);

// Start server
const port = parseInt(process.env.PORT || '3001');
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`🚀 API server running on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
