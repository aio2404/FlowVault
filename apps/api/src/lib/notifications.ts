import { prisma } from './prisma.js';
import { decryptFromDb } from './encryption.js';
import { sendSlackNotification } from './slack.js';

const WEB_APP_URL = process.env.WEB_URL || 'http://localhost:3000';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'alerts@flowvault.dev';

interface OrgNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

function normalizeEmails(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
      .filter((email) => email.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0);
  }
  return [];
}

async function sendEmailNotification(payload: OrgNotificationPayload, recipients: string[]) {
  if (!RESEND_API_KEY || recipients.length === 0) {
    console.warn('Email notification skipped – RESEND_API_KEY missing or no recipients.');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: recipients,
        subject: `[FlowVault] ${payload.title}`,
        text: `${payload.body}${payload.url ? `\n${payload.url}` : ''}`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Failed to send email notification:', body);
    }
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

async function sendTeamsNotification(webhookUrl: string, payload: OrgNotificationPayload) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: payload.title,
        themeColor: '6366F1',
        title: payload.title,
        text: `${payload.body}${payload.url ? `\n\n[Ouvrir dans FlowVault](${payload.url})` : ''}`,
      }),
    });
  } catch (error) {
    console.error('Failed to send Teams notification:', error);
  }
}

async function sendCustomWebhook(webhookUrl: string, payload: OrgNotificationPayload) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        timestamp: new Date().toISOString(),
        source: 'flowvault',
      }),
    });
  } catch (error) {
    console.error('Failed to send custom webhook notification:', error);
  }
}

export async function sendOrgNotification(
  organizationId: string,
  payload: OrgNotificationPayload
) {
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
  });

  if (!settings) {
    return;
  }

  const tasks: Promise<unknown>[] = [];

  if (settings.slackWebhookUrlEncrypted) {
    const webhookUrl = decryptFromDb(
      settings.slackWebhookUrlEncrypted,
      settings.slackWebhookUrlIv!,
      settings.slackWebhookUrlTag!
    );

    tasks.push(
      sendSlackNotification(webhookUrl, {
        text: `*${payload.title}*\n${payload.body}${payload.url ? `\n${payload.url}` : ''}`,
      })
    );
  }

  if (settings.alertEmails) {
    const recipients = normalizeEmails(settings.alertEmails);
    if (recipients.length > 0) {
      tasks.push(sendEmailNotification(payload, recipients));
    }
  }

  if (settings.teamsWebhookUrlEncrypted) {
    const teamsWebhook = decryptFromDb(
      settings.teamsWebhookUrlEncrypted,
      settings.teamsWebhookUrlIv!,
      settings.teamsWebhookUrlTag!
    );
    tasks.push(sendTeamsNotification(teamsWebhook, payload));
  }

  if (settings.customWebhookUrlEncrypted) {
    const customWebhook = decryptFromDb(
      settings.customWebhookUrlEncrypted,
      settings.customWebhookUrlIv!,
      settings.customWebhookUrlTag!
    );
    tasks.push(sendCustomWebhook(customWebhook, payload));
  }

  if (tasks.length === 0) {
    console.log(
      `[Notifications] No channels configured for organization ${organizationId}. Skipping notification "${payload.title}".`
    );
    return;
  }

  await Promise.allSettled(tasks);
}

export function buildWorkflowUrl(workflowId: string) {
  return `${WEB_APP_URL}/app/workflows/${workflowId}`;
}
