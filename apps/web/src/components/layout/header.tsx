'use client';

import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, Command } from 'lucide-react';
import { SupportWidget } from '@/components/support-widget';

const pageTitles: Record<string, { title: string; description: string }> = {
  '/app': { title: 'Dashboard', description: 'Overview of your workflows' },
  '/app/monitoring': { title: 'Monitoring', description: 'Real-time health status' },
  '/app/instances': { title: 'Instances', description: 'Manage n8n connections' },
  '/app/workflows': { title: 'Workflows', description: 'Track and version workflows' },
  '/app/settings': { title: 'Settings', description: 'Configure workspace' },
};

interface HeaderProps {
  onSearchClick?: () => void;
}

export function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();

  let pageInfo = pageTitles['/app'];
  for (const [path, info] of Object.entries(pageTitles)) {
    if (pathname === path || (path !== '/app' && pathname.startsWith(path))) {
      pageInfo = info;
      if (path === pathname) break;
    }
  }

  if (pathname.startsWith('/app/workflows/') && pathname !== '/app/workflows') {
    pageInfo = { title: 'Workflow', description: 'Version history and diff' };
  }

  return (
    <header className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{pageInfo.title}</h1>
        <p className="text-sm text-muted-foreground">{pageInfo.description}</p>
      </div>
      
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="hidden md:flex items-center gap-2 px-3 text-muted-foreground hover:text-foreground h-9 min-w-[200px] justify-start"
          onClick={onSearchClick}
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Search...</span>
          <div className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground/60">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </Button>
        <SupportWidget />
      </div>
    </header>
  );
}
