export interface SlackMessage {
  text: string;
  blocks?: unknown[];
}

export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return false;
  }
}

export function formatWorkflowChangeMessage(
  workflowName: string,
  instanceName: string,
  versionCount: number
): SlackMessage {
  return {
    text: `🔄 Workflow "${workflowName}" changed on ${instanceName} (version #${versionCount})`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔄 *Workflow Change Detected*\n\n*Workflow:* ${workflowName}\n*Instance:* ${instanceName}\n*Version:* #${versionCount}`,
        },
      },
    ],
  };
}

export function formatRollbackFailureMessage(
  workflowName: string,
  instanceName: string,
  error: string
): SlackMessage {
  return {
    text: `❌ Rollback failed for "${workflowName}" on ${instanceName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Rollback Failed*\n\n*Workflow:* ${workflowName}\n*Instance:* ${instanceName}\n*Error:* ${error}`,
        },
      },
    ],
  };
}



