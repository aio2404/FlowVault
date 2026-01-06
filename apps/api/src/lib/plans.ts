import type { PlanTier } from '@prisma/client';
import { prisma } from './prisma.js';

interface PlanDefinition {
  id: PlanTier;
  name: string;
  monthlyPrice: number;
  currency: 'USD';
  instanceLimit: number;
  workflowLimit: number;
  description: string;
  features: string[];
}

export const PLAN_ORDER: PlanTier[] = ['FREE', 'PRO', 'TEAM'];

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Starter',
    monthlyPrice: 0,
    currency: 'USD',
    instanceLimit: 1,
    workflowLimit: 2,
    description: 'Perfect to safeguard a side project or try FlowVault on a single n8n instance.',
    features: [
      '1 connected instance',
      '2 tracked workflows',
      '30 days of workflow history',
      'Community support',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    monthlyPrice: 39,
    currency: 'USD',
    instanceLimit: 5,
    workflowLimit: 25,
    description: 'For teams that run automation in production and need promotion + alerting.',
    features: [
      'Up to 5 instances',
      '25 tracked workflows',
      '1 year of history & rollback',
      'Slack alerts + audit logs',
      'Priority support',
    ],
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    monthlyPrice: 99,
    currency: 'USD',
    instanceLimit: 15,
    workflowLimit: 100,
    description: 'Full observability for agencies or scale-ups running multiple automation pods.',
    features: [
      'Up to 15 instances',
      '100 tracked workflows',
      'Advanced monitoring & error triage',
      'Role-based access (SSO ready)',
      'Dedicated success engineer',
    ],
  },
} as const;

function applyAddons(plan: PlanDefinition, extraInstances: number, extraWorkflows: number) {
  return {
    instances: plan.instanceLimit + extraInstances,
    workflows: plan.workflowLimit + extraWorkflows,
  };
}

export async function getOrganizationPlanContext(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      extraInstanceCredits: true,
      extraWorkflowCredits: true,
      planRenewsAt: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const definition = PLAN_DEFINITIONS[org.plan];
  const limits = applyAddons(definition, org.extraInstanceCredits, org.extraWorkflowCredits);

  return {
    organizationId,
    plan: org.plan,
    definition,
    limits,
    planRenewsAt: org.planRenewsAt?.toISOString() ?? null,
  };
}

export async function getOrganizationUsage(organizationId: string) {
  const [instanceCount, workflowCount] = await Promise.all([
    prisma.n8nInstance.count({ where: { organizationId } }),
    prisma.workflow.count({ where: { organizationId } }),
  ]);

  return {
    instances: instanceCount,
    workflows: workflowCount,
  };
}

export async function getBillingSummary(organizationId: string) {
  const [context, usage] = await Promise.all([
    getOrganizationPlanContext(organizationId),
    getOrganizationUsage(organizationId),
  ]);

  return {
    ...context,
    usage,
    availablePlans: PLAN_ORDER.map((tier) => PLAN_DEFINITIONS[tier]),
  };
}

export function sanitizePlanId(planId: string): PlanTier | null {
  const upper = planId.toUpperCase() as PlanTier;
  return PLAN_ORDER.includes(upper) ? upper : null;
}

export function serializePlan(definition: PlanDefinition) {
  return {
    id: definition.id,
    name: definition.name,
    price: definition.monthlyPrice,
    currency: definition.currency,
    instanceLimit: definition.instanceLimit,
    workflowLimit: definition.workflowLimit,
    description: definition.description,
    features: definition.features,
  };
}

export async function getInstanceLimitSnapshot(organizationId: string) {
  const context = await getOrganizationPlanContext(organizationId);
  const instanceCount = await prisma.n8nInstance.count({ where: { organizationId } });
  return {
    context,
    count: instanceCount,
    remaining: Math.max(0, context.limits.instances - instanceCount),
    limit: context.limits.instances,
  };
}

export async function getWorkflowLimitSnapshot(organizationId: string) {
  const context = await getOrganizationPlanContext(organizationId);
  const workflowCount = await prisma.workflow.count({ where: { organizationId } });
  return {
    context,
    count: workflowCount,
    remaining: Math.max(0, context.limits.workflows - workflowCount),
    limit: context.limits.workflows,
  };
}
