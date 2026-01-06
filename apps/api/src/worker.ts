import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from './lib/prisma.js';
import { decryptFromDb } from './lib/encryption.js';
import { createN8nClient } from './lib/n8n-client.js';
import { computeDeepHash } from './lib/hash.js';
import { sendOrgNotification, buildWorkflowUrl } from './lib/notifications.js';
import { getOrganizationPlanContext } from './lib/plans.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10); // default 5 minutes
const POLL_CONCURRENCY = parseInt(process.env.POLL_CONCURRENCY || '5', 10);

const WEB_APP_URL = process.env.WEB_URL || 'http://localhost:3000';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Queue for polling jobs
const pollQueue = new Queue('poll-instance', { connection });

// Worker to process polling jobs
const worker = new Worker(
  'poll-instance',
  async (job) => {
    const { instanceId } = job.data;

    console.log(`[Worker] Polling instance: ${instanceId}`);

    const instance = await prisma.n8nInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      console.log(`[Worker] Instance not found: ${instanceId}`);
      return;
    }

    // Decrypt API key
    const apiKey = decryptFromDb(
      instance.apiKeyEncrypted,
      instance.apiKeyIv,
      instance.apiKeyTag
    );

    const client = createN8nClient({
      baseUrl: instance.baseUrl,
      apiKey,
    });

    const planContext = await getOrganizationPlanContext(instance.organizationId);
    let currentWorkflowCount = await prisma.workflow.count({
      where: { organizationId: instance.organizationId },
    });
    const workflowLimit = planContext.limits.workflows;
    let skippedNewWorkflows = 0;

    try {
      const n8nWorkflows = await client.listWorkflows();

      let newVersions = 0;

      for (const wf of n8nWorkflows) {
        // Fetch full workflow
        const fullWorkflow = await client.getWorkflow(wf.id);
        const hash = computeDeepHash(fullWorkflow);

        // Find existing workflow
        let workflow = await prisma.workflow.findFirst({
          where: {
            n8nInstanceId: instanceId,
            n8nWorkflowId: wf.id,
          },
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (workflow) {
          // Update workflow info
          await prisma.workflow.update({
            where: { id: workflow.id },
            data: {
              name: wf.name,
              active: wf.active,
            },
          });

          // Check if we need a new version
          const latestHash = workflow.versions[0]?.hash;
          if (latestHash !== hash) {
            const versionCount = await prisma.workflowVersion.count({
              where: { workflowId: workflow.id },
            });

            await prisma.workflowVersion.create({
              data: {
                organizationId: instance.organizationId,
                workflowId: workflow.id,
                hash,
                jsonContent: fullWorkflow as object,
                label: 'Auto-detected change',
              },
            });

            newVersions++;

            await sendOrgNotification(instance.organizationId, {
              title: `Workflow mis à jour • ${wf.name}`,
              body: `L'instance ${instance.name} a détecté une nouvelle version (#${versionCount + 1}).`,
              url: buildWorkflowUrl(workflow.id),
            });
          }
        } else {
          if (currentWorkflowCount >= workflowLimit) {
            skippedNewWorkflows++;
            continue;
          }
          // Create new workflow
          workflow = await prisma.workflow.create({
            data: {
              organizationId: instance.organizationId,
              n8nInstanceId: instanceId,
              n8nWorkflowId: wf.id,
              name: wf.name,
              active: wf.active,
            },
          });

          // Create initial version
          await prisma.workflowVersion.create({
            data: {
              organizationId: instance.organizationId,
              workflowId: workflow.id,
              hash,
              jsonContent: fullWorkflow as object,
              label: 'Initial import',
            },
          });

          newVersions++;
          currentWorkflowCount++;

          await sendOrgNotification(instance.organizationId, {
            title: `Workflow importé • ${wf.name}`,
            body: `Le workflow ${wf.name} vient d'être importé depuis ${instance.name}.`,
            url: buildWorkflowUrl(workflow.id),
          });
        }
      }

      // Update instance status
      await prisma.n8nInstance.update({
        where: { id: instanceId },
        data: {
          status: 'connected',
          lastSeenAt: new Date(),
        },
      });

      if (skippedNewWorkflows > 0) {
        console.warn(
          `[Worker] Workflow limit reached for organization ${instance.organizationId}. Skipped ${skippedNewWorkflows} new workflow(s).`
        );
      }

      console.log(`[Worker] Instance ${instanceId} polled. New versions: ${newVersions}`);
    } catch (error) {
      console.error(`[Worker] Error polling instance ${instanceId}:`, error);

      await prisma.n8nInstance.update({
        where: { id: instanceId },
        data: { status: 'error' },
      });
    }
  },
  {
    connection,
    concurrency: Number.isFinite(POLL_CONCURRENCY) && POLL_CONCURRENCY > 0 ? POLL_CONCURRENCY : 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

// Schedule polling for all instances
let schedulingInProgress = false;

async function schedulePolling() {
  if (schedulingInProgress) {
    return;
  }

  schedulingInProgress = true;

  try {
    console.log('[Worker] Scheduling polling jobs...');

    const instances = await prisma.n8nInstance.findMany({
      select: { id: true },
    });
    const repeatableJobs = await pollQueue.getRepeatableJobs();
    const existingJobIds = new Set(repeatableJobs.map((job) => job.id));
    let createdJobs = 0;

    for (const instance of instances) {
      const jobId = `poll-${instance.id}`;
      if (existingJobIds.has(jobId)) {
        continue;
      }

      await pollQueue.add(
        'poll',
        { instanceId: instance.id },
        {
          repeat: {
            every: POLL_INTERVAL_MS,
          },
          jobId,
        }
      );
      createdJobs++;
    }

    // Remove repeatable jobs for deleted instances
    const instanceIds = new Set(instances.map((instance) => instance.id));
    for (const job of repeatableJobs) {
      if (!job.id?.startsWith('poll-')) continue;
      const instanceId = job.id.replace('poll-', '');
      if (!instanceIds.has(instanceId)) {
        await pollQueue.removeRepeatableByKey(job.key);
      }
    }

    console.log(`[Worker] Scheduling complete. Instances: ${instances.length}, new jobs: ${createdJobs}`);
  } catch (error) {
    console.error('[Worker] Failed to schedule polling jobs:', error);
  } finally {
    schedulingInProgress = false;
  }
}

// Also poll immediately on startup
async function pollAllNow() {
  console.log('[Worker] Running immediate poll for all instances...');

  const instances = await prisma.n8nInstance.findMany();

  for (const instance of instances) {
    await pollQueue.add('poll-now', { instanceId: instance.id });
  }
}

// Main
async function main() {
  console.log('[Worker] Starting background worker...');
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[Worker] Concurrency: ${Number.isFinite(POLL_CONCURRENCY) ? POLL_CONCURRENCY : 5}`);

  await schedulePolling();
  await pollAllNow();

  // Re-schedule when new instances are added (check every minute)
  setInterval(() => {
    void schedulePolling();
  }, 60000);
}

main().catch(console.error);
