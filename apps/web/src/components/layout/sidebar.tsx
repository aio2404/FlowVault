'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore, useThemeStore } from '@/lib/store';
import {
  LayoutDashboard,
  Server,
  GitBranch,
  Settings,
  LogOut,
  Moon,
  Sun,
  Activity,
  Vault,
  CreditCard,
  LifeBuoy,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const navigation = [
  { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { name: 'Monitoring', href: '/app/monitoring', icon: Activity },
  { name: 'Instances', href: '/app/instances', icon: Server },
  { name: 'Workflows', href: '/app/workflows', icon: GitBranch },
  { name: 'Billing', href: '/app/billing', icon: CreditCard },
  { name: 'Settings', href: '/app/settings', icon: Settings },
  { name: 'Support', href: '/app/support', icon: LifeBuoy },
];

export function Sidebar() {
  const pathname = usePathname();
  const { organizations, currentOrgId, setCurrentOrg, user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <aside className="w-56 border-r border-border/50 bg-card/30 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-border/50">
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <Vault className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">FlowVault</span>
        </Link>
      </div>

      {/* Organization Selector */}
      <div className="p-3 border-b border-border/50">
        <Select value={currentOrgId || ''} onValueChange={setCurrentOrg}>
          <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 text-sm">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navigation.map((item) => {
          const isActive =
            item.href === '/app'
              ? pathname === '/app'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'nav-link',
                isActive && 'active'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-border/50 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4" />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              <span>Dark mode</span>
            </>
          )}
        </button>

        {/* User */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || user?.email?.split('@')[0]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
