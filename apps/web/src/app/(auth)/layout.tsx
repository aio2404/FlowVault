import { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from '@/components/theme-provider';
import { Vault } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b border-border/50 bg-card/40 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                <Vault className="w-4 h-4 text-primary-foreground" />
              </div>
              FlowVault
            </Link>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/">
                <Button variant="ghost" size="sm">
                  Landing
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="sm">Log in</Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">{children}</main>
      </div>
    </ThemeProvider>
  );
}
