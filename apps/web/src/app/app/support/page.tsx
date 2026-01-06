"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageCircle,
} from "lucide-react";

const supportChannels = [
  {
    title: "Email",
    description: "Send critical issues or billing questions",
    detail: "support@flowvault.dev",
    icon: Mail,
    href: "mailto:support@flowvault.dev",
  },
  {
    title: "Community Hub",
    description: "Share best practices with other operators",
    detail: "community.flowvault.dev",
    icon: MessageCircle,
    href: "https://community.flowvault.dev",
  },
  {
    title: "Status page",
    description: "Subscribe to incident + maintenance updates",
    detail: "status.flowvault.dev",
    icon: AlertTriangle,
    href: "https://status.flowvault.dev",
  },
];

const marketingAssets = [
  {
    title: "Tweet templates",
    blurb: "Ready-made snippets to tease launches or diff features.",
    action: "Download",
    href: "https://flowvault.dev/marketing/tweets",
  },
  {
    title: "Launch email copy",
    blurb: "Kick-off emails for your mailing list announcing FlowVault rollout.",
    action: "Copy text",
    href: "https://flowvault.dev/marketing/email",
  },
  {
    title: "Press kit",
    blurb: "Logos, screenshots, and brand guidelines.",
    action: "Open kit",
    href: "https://flowvault.dev/marketing/press",
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            Support center
          </CardTitle>
          <CardDescription>
            Reach the FlowVault team, review SLAs, and grab marketing assets to
            promote your automation practice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {supportChannels.map((channel) => (
            <div
              key={channel.title}
              className="rounded-lg border border-border/60 p-4 space-y-2"
            >
              <channel.icon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">{channel.title}</h3>
              <p className="text-sm text-muted-foreground">
                {channel.description}
              </p>
              <a
                href={channel.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary font-medium hover:underline"
              >
                {channel.detail}
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Response targets
            </CardTitle>
            <CardDescription>
              SLA overview (full matrix lives in docs/support/README.md)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded border border-border/60 p-3">
              <div>
                <p className="font-medium">Free</p>
                <p className="text-muted-foreground text-xs">
                  Email support within 2 business days
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Community & knowledge base
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-border/60 p-3">
              <div>
                <p className="font-medium">Pro</p>
                <p className="text-muted-foreground text-xs">
                  Responses in 1 business day
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Slack Connect on demand
              </span>
            </div>
            <div className="flex items-center justify-between rounded border border-border/60 p-3">
              <div>
                <p className="font-medium">Team</p>
                <p className="text-muted-foreground text-xs">
                  <strong>4 hour</strong> response & dedicated engineer
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                Phone bridge for Sev1
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escalate an incident</CardTitle>
            <CardDescription>
              Attach workflow IDs + execution logs when reporting failures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal pl-4 space-y-2">
              <li>Open a ticket via email or the community form.</li>
              <li>
                Include workflow ID, instance base URL, and recent execution
                errors.
              </li>
              <li>
                Ping <code>#flowvault-oncall</code> (Team plan) or request a
                Zoom via support email if unresolved past SLA.
              </li>
              <li>
                Track updates on the{" "}
                <Link
                  href="https://status.flowvault.dev"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  status page
                </Link>{" "}
                or subscribe to SMS notifications.
              </li>
            </ol>
            <Button asChild className="w-full">
              <a href="mailto:support@flowvault.dev?subject=Sev1%20incident">
                Open Sev1 ticket
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card id="marketing">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            Marketing toolkit
          </CardTitle>
          <CardDescription>
            Ready-to-use assets to tease FlowVault, share monitoring wins, or
            announce upgrades.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {marketingAssets.map((asset) => (
            <div
              key={asset.title}
              className="rounded-lg border border-border/60 p-4 space-y-2"
            >
              <p className="text-sm font-semibold">{asset.title}</p>
              <p className="text-sm text-muted-foreground">{asset.blurb}</p>
              <Link
                href={asset.href}
                target="_blank"
                className="text-xs font-medium text-primary hover:underline"
              >
                {asset.action}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
