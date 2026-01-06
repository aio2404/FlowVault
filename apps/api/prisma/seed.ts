import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Simple encryption for seed data
function encryptForSeed(plaintext: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY environment variable is required");
  }
  const keyBuffer = Buffer.from(key, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    encrypted: ciphertext,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

async function main() {
  console.log("🌱 Seeding database...");

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@n8nback.dev" },
    update: {},
    create: {
      email: "demo@n8nback.dev",
      name: "Demo User",
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-id" },
    update: {},
    create: {
      id: "demo-org-id",
      name: "Demo Organization",
      plan: "PRO",
      planStartedAt: new Date(),
      planRenewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created organization: ${org.name}`);

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "owner",
    },
  });

  console.log(`✅ Created membership for ${user.email} as owner`);

  // Create org settings
  await prisma.orgSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
    },
  });

  // Create a demo n8n instance pointing to mock service
  const apiKey = encryptForSeed("mock-api-key-12345");

  const instance = await prisma.n8nInstance.upsert({
    where: { id: "demo-instance-id" },
    update: {},
    create: {
      id: "demo-instance-id",
      organizationId: org.id,
      name: "Local Mock n8n",
      baseUrl: process.env.MOCK_N8N_URL || "http://localhost:5678",
      apiKeyEncrypted: apiKey.encrypted,
      apiKeyIv: apiKey.iv,
      apiKeyTag: apiKey.tag,
      status: "disconnected",
    },
  });

  console.log(
    `✅ Created n8n instance: ${instance.name} (${instance.baseUrl})`
  );

  // Create demo workflows with versions
  const demoWorkflows = [
    {
      id: "demo-workflow-1",
      name: "Email Notification Workflow",
      n8nWorkflowId: "wf-1",
      active: true,
    },
    {
      id: "demo-workflow-2",
      name: "Data Sync Pipeline",
      n8nWorkflowId: "wf-2",
      active: true,
    },
    {
      id: "demo-workflow-3",
      name: "Slack Alert Bot",
      n8nWorkflowId: "wf-3",
      active: false,
    },
    {
      id: "demo-workflow-4",
      name: "Marketing Promo Scheduler",
      n8nWorkflowId: "wf-marketing",
      active: true,
    },
  ];

  for (const wf of demoWorkflows) {
    const workflow = await prisma.workflow.upsert({
      where: { id: wf.id },
      update: {},
      create: {
        id: wf.id,
        organizationId: org.id,
        n8nInstanceId: instance.id,
        n8nWorkflowId: wf.n8nWorkflowId,
        name: wf.name,
        active: wf.active,
      },
    });

    const nodes =
      wf.id === "demo-workflow-4"
        ? [
            { name: "Cron", type: "n8n-nodes-base.cron", position: [0, 0] },
            {
              name: "Fetch FlowVault Stats",
              type: "n8n-nodes-base.httpRequest",
              position: [220, 0],
            },
            {
              name: "Generate Tweet",
              type: "n8n-nodes-base.openAi",
              position: [440, 0],
            },
            {
              name: "Post to Twitter",
              type: "n8n-nodes-base.twitter",
              position: [660, 0],
            },
          ]
        : [
            { name: "Start", type: "n8n-nodes-base.start", position: [0, 0] },
            {
              name: "HTTP Request",
              type: "n8n-nodes-base.httpRequest",
              position: [200, 0],
            },
          ];

    const connections =
      wf.id === "demo-workflow-4"
        ? {
            Cron: {
              main: [
                [{ node: "Fetch FlowVault Stats", type: "main", index: 0 }],
              ],
            },
            "Fetch FlowVault Stats": {
              main: [[{ node: "Generate Tweet", type: "main", index: 0 }]],
            },
            "Generate Tweet": {
              main: [[{ node: "Post to Twitter", type: "main", index: 0 }]],
            },
          }
        : {
            Start: {
              main: [[{ node: "HTTP Request", type: "main", index: 0 }]],
            },
          };

    // Create initial version
    await prisma.workflowVersion.upsert({
      where: { id: `${wf.id}-v1` },
      update: {},
      create: {
        id: `${wf.id}-v1`,
        organizationId: org.id,
        workflowId: workflow.id,
        versionNumber: 1,
        hash: crypto.randomBytes(16).toString("hex"),
        jsonContent: {
          nodes,
          connections,
        },
        label:
          wf.id === "demo-workflow-4"
            ? "Initial marketing automation"
            : "Initial version",
      },
    });

    console.log(`✅ Created workflow: ${wf.name}`);
  }

  // Create demo executions with errors for testing error tracking
  const errorExamples = [
    {
      workflowId: "demo-workflow-1",
      status: "error",
      mode: "trigger",
      errorMessage:
        "NodeOperationError: Node 'HTTP Request' Error: Request failed with status code 401 - Unauthorized",
      startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
    {
      workflowId: "demo-workflow-1",
      status: "error",
      mode: "manual",
      errorMessage:
        "NodeOperationError: Node 'Slack' Error: Credential not found. Please add a credential for 'Slack API'",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      workflowId: "demo-workflow-2",
      status: "error",
      mode: "trigger",
      errorMessage:
        "ECONNREFUSED: Connection refused to database server at localhost:5432",
      startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    },
    {
      workflowId: "demo-workflow-2",
      status: "error",
      mode: "webhook",
      errorMessage:
        "Request failed with status code 429 - Too Many Requests. Rate limit exceeded.",
      startedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    },
    {
      workflowId: "demo-workflow-3",
      status: "error",
      mode: "manual",
      errorMessage:
        "Timeout: Operation timed out after 30000ms waiting for response from API",
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    },
    {
      workflowId: "demo-workflow-1",
      status: "success",
      mode: "trigger",
      errorMessage: null,
      startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    },
    {
      workflowId: "demo-workflow-2",
      status: "success",
      mode: "webhook",
      errorMessage: null,
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    },
  ];

  for (let i = 0; i < errorExamples.length; i++) {
    const exec = errorExamples[i];
    const stoppedAt = new Date(
      exec.startedAt.getTime() + Math.random() * 5000 + 1000
    );

    await prisma.workflowExecution.upsert({
      where: {
        workflowId_n8nExecutionId: {
          workflowId: exec.workflowId,
          n8nExecutionId: `exec-${i + 1}`,
        },
      },
      update: {},
      create: {
        workflowId: exec.workflowId,
        n8nExecutionId: `exec-${i + 1}`,
        status: exec.status,
        mode: exec.mode,
        startedAt: exec.startedAt,
        stoppedAt,
        durationMs: stoppedAt.getTime() - exec.startedAt.getTime(),
        errorMessage: exec.errorMessage,
      },
    });
  }

  console.log(
    `✅ Created ${errorExamples.length} demo executions (including ${
      errorExamples.filter((e) => e.status === "error").length
    } with errors)`
  );

  // Seed billing usage snapshots for the last 6 months
  const now = new Date();
  const snapshots = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)
    );
    const monthInstances = 3 + Math.max(0, 2 - index);
    const monthWorkflows = 15 + index * 2;
    const costUsd = 39 + index * 5;
    return {
      month: date,
      instances: monthInstances,
      workflows: monthWorkflows,
      costInCents: costUsd * 100,
    };
  });

  for (const snapshot of snapshots) {
    await prisma.billingUsageSnapshot.upsert({
      where: {
        organizationId_month: {
          organizationId: org.id,
          month: snapshot.month,
        },
      },
      update: {
        instances: snapshot.instances,
        workflows: snapshot.workflows,
        costInCents: snapshot.costInCents,
      },
      create: {
        organizationId: org.id,
        month: snapshot.month,
        instances: snapshot.instances,
        workflows: snapshot.workflows,
        costInCents: snapshot.costInCents,
      },
    });
  }

  console.log("✅ Seeded billing usage snapshots");

  // Create a demo session for the user (valid for 30 days)
  const sessionToken =
    "demo-session-token-" + crypto.randomBytes(16).toString("hex");

  await prisma.session.upsert({
    where: { id: "demo-session-id" },
    update: {
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: "demo-session-id",
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`✅ Created demo session`);
  console.log(`\n📋 Demo credentials:`);
  console.log(`   Email: demo@n8nback.dev`);
  console.log(`   Session Token: ${sessionToken}`);
  console.log(`   Organization ID: ${org.id}`);

  console.log("\n🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
