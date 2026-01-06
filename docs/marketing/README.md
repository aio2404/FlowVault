# Marketing Automation Workflows

> Draft playbook for FlowVault customers that want to promote their automation stacks via n8n.

## 1. Twitter / X Promo Bot

Goal: publish teasers for new monitoring capabilities once or twice per week.

### Prerequisites

- Twitter/X developer account + OAuth2 app
- FlowVault API token (read-only)
- Optional: OpenAI API key for AI-generated copy

### Suggested n8n workflow

1. **Cron node** – schedule every Tuesday & Thursday at 10:00.
2. **HTTP Request → FlowVault** – call `/workflows?status=success&limit=5` to pick highlights.
3. **Set node** – build prompt for AI summarization using workflow metadata (diff count, uptime).
4. **OpenAI node** – generate 280-character teaser with CTA.
5. **Twitter node** – publish tweet with generated text and link to landing page.
6. **Slack node (optional)** – notify marketing channel that a teaser went live.

```
{
  "nodes": [
    { "name": "Cron", "type": "n8n-nodes-base.cron" },
    { "name": "Fetch Workflows", "type": "n8n-nodes-base.httpRequest" },
    { "name": "Prepare Prompt", "type": "n8n-nodes-base.set" },
    { "name": "AI Copy", "type": "n8n-nodes-base.openAi" },
    { "name": "Tweet", "type": "n8n-nodes-base.twitter" },
    { "name": "Slack Alert", "type": "n8n-nodes-base.slack" }
  ]
}
```

## 2. Changelog Digest Email

Send a weekly recap with recent incidents, diffs, and upcoming maintenance.

Steps:

1. Cron weekly on Monday.
2. Query FlowVault `/audit-logs?action=in.workflow.promoted`.
3. Summarize via Markdown table.
4. Send via Postmark or Sendgrid node to mailing list.

## 3. Lead Magnet Automation

Collect leads from a waitlist form and nurture them automatically:

- Trigger via Webhook node connected to landing page form.
- Add to Airtable/Notion CRM.
- Kick off email drip (3-step) and Slack alert for sales.
- After conversion, call FlowVault API to provision a PRO trial org.

## Measuring Impact

- Track clicks via UTM parameters appended in nodes.
- Log metrics (tweet ID, likes, conversions) in FlowVault using custom workflows table or external sheet.

## Resources

- Tweet template library: `/app/support#marketing`
- Blog-ready changelog copy: `/infra/content/changelog` (planned)
- Press kit: `marketing/press-kit/` (TODO)

Keep these workflows under version control – FlowVault will snapshot them like any other automation, so you can roll back marketing experiments safely.
