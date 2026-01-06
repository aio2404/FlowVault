'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { LifeBuoy, MessageCircle, Mail, Megaphone } from 'lucide-react';

export function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          aria-label="Open FlowVault support resources"
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Support</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            Need help?
          </DialogTitle>
          <DialogDescription>
            Reach out to the FlowVault team or explore resources to help market your automation stack.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="w-4 h-4 text-primary" />
              Contact support
            </div>
            <p className="text-sm text-muted-foreground">
              Email <a href="mailto:support@flowvault.dev" className="text-primary hover:underline">support@flowvault.dev</a> for troubleshooting or SLA questions.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="w-4 h-4 text-primary" />
              Join the community
            </div>
            <p className="text-sm text-muted-foreground">
              Ask other operators in <Link href="https://community.flowvault.dev" className="text-primary hover:underline" target="_blank" rel="noreferrer">Community Hub</Link> or request a private Slack Connect channel.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-primary/40 p-4 space-y-2 bg-primary/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Megaphone className="w-4 h-4" />
              Marketing boosters
            </div>
            <p className="text-sm text-muted-foreground">
              Ready to promote your automations? Grab tweet templates and launch emails right inside FlowVault.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/app/support#marketing"
                className="text-xs font-medium px-3 py-1.5 rounded bg-primary text-primary-foreground"
                onClick={() => setOpen(false)}
              >
                View assets
              </Link>
              <a
                href="mailto:marketing@flowvault.dev?subject=Case%20study"
                className="text-xs font-medium px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setOpen(false)}
              >
                Request case study
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
