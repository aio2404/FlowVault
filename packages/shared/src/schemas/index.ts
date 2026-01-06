import { z } from 'zod';

// URL validation helper
const urlSchema = z.string().url().refine((url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, 'Must be a valid HTTP/HTTPS URL');

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
});

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'member']).default('member'),
});

// n8n Instance schemas
export const createInstanceSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: urlSchema,
  apiKey: z.string().min(1),
});

export const updateInstanceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: urlSchema.optional(),
  apiKey: z.string().min(1).optional(),
});

// Workflow schemas
export const snapshotLabelSchema = z.object({
  label: z.string().max(200).optional(),
});

export const rollbackSchema = z.object({
  versionId: z.string().uuid(),
  confirm: z.literal(true),
});

// Settings schemas
export const updateSettingsSchema = z.object({
  slackWebhookUrl: urlSchema.nullable().optional(),
});

// Polling config
export const pollingConfigSchema = z.object({
  intervalMinutes: z.number().min(1).max(60).default(5),
});

// API Response types
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>;
export type SnapshotLabelInput = z.infer<typeof snapshotLabelSchema>;
export type RollbackInput = z.infer<typeof rollbackSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type PollingConfigInput = z.infer<typeof pollingConfigSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;



