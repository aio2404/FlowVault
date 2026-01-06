'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  History,
  GitBranch,
  RotateCcw,
  Zap,
  Shield,
  Bell,
  ArrowRight,
  Terminal,
  Vault,
  Activity,
  Boxes,
  Rocket,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/language-switcher';

const features = [
  {
    icon: History,
    title: 'Auto-versioning',
    description: 'Every change captured automatically. No commits, no hassle.',
  },
  {
    icon: GitBranch,
    title: 'Visual diffs',
    description: 'See exactly what changed. Node by node, field by field.',
  },
  {
    icon: RotateCcw,
    title: 'Instant rollback',
    description: 'Restore any version with one click. Zero downtime.',
  },
  {
    icon: Boxes,
    title: 'Multi-platform',
    description: 'Works with n8n, Make, Activepieces and more.',
  },
  {
    icon: Rocket,
    title: 'Dev → Prod',
    description: 'Promote workflows between environments with variables.',
  },
  {
    icon: Activity,
    title: 'Error tracking',
    description: 'Centralized error monitoring across all instances.',
  },
];

const platforms = [
  { name: 'n8n', icon: '⚡', color: 'bg-[#FF6D5A]' },
  { name: 'Make', icon: '🔮', color: 'bg-[#6D29D9]' },
  { name: 'Activepieces', icon: '🧩', color: 'bg-[#6E41E2]' },
  { name: 'Zapier', icon: '⚡', color: 'bg-[#FF4A00]', soon: true },
  { name: 'Node-RED', icon: '🔴', color: 'bg-[#8F0000]', soon: true },
];

const marketingHighlights = [
  {
    title: 'Launch kit',
    description: 'Newsletter + email copy to announce FlowVault to your customers.',
    cta: 'Get templates',
    href: '/app/support#marketing',
  },
  {
    title: 'Tweet threads',
    description: 'Pre-built teaser threads for sharing workflow insights every week.',
    cta: 'Preview threads',
    href: 'https://flowvault.dev/marketing/tweets',
  },
  {
    title: 'Community showcase',
    description: 'Submit your favourite workflows for the monthly spotlight.',
    cta: 'Submit workflow',
    href: 'mailto:marketing@flowvault.dev?subject=Showcase%20submission',
  },
];

export default function LandingPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 grid-pattern opacity-30" />
      
      {/* Gradient orbs */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px]" />
      <div className="fixed bottom-0 right-1/3 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      {/* Header */}
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <Vault className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">FlowVault</span>
          </Link>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">{t('nav.login')}</Button>
              </Link>
              <Link href="/auth/login">
                <Button size="sm">
                  {t('nav.getStarted')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="max-w-3xl">
          {/* Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8 fade-up">
            <Shield className="w-3.5 h-3.5" />
            {t('hero.tagline')}
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 fade-up" style={{ animationDelay: '50ms' }}>
            {t('hero.title.line1')}
            <br />
            <span className="text-primary">{t('hero.title.line2')}</span>
          </h1>
          
          {/* Subheadline */}
          <p
            className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed fade-up"
            style={{ animationDelay: '100ms' }}
          >
            {t('hero.subtitle')}
            <br />
            For <strong>n8n</strong>, <strong>Make</strong>, <strong>Activepieces</strong> and more.
          </p>
          
          {/* CTA */}
          <div className="flex items-center gap-3 fade-up" style={{ animationDelay: '150ms' }}>
            <Link href="/auth/login">
              <Button size="lg" className="h-11 px-6">
                {t('hero.cta.primary')} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-11 px-6">
                {t('hero.cta.secondary')}
              </Button>
            </Link>
          </div>
          
          {/* Platform logos */}
          <div className="flex items-center gap-3 mt-12 pt-8 border-t border-border/50 fade-up" style={{ animationDelay: '200ms' }}>
            <span className="text-xs text-muted-foreground mr-2">Works with:</span>
            {platforms.map((platform) => (
              <div 
                key={platform.name}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                  platform.soon 
                    ? 'bg-muted/50 text-muted-foreground' 
                    : 'bg-card border border-border/50'
                }`}
              >
                <span>{platform.icon}</span>
                <span>{platform.name}</span>
                {platform.soon && <span className="text-[10px] opacity-60">soon</span>}
              </div>
            ))}
          </div>
        </div>
        
        {/* Code preview */}
        <div className="hidden lg:block absolute right-0 top-32 w-[420px] fade-up" style={{ animationDelay: '250ms' }}>
          <div className="bg-card border border-primary/20 rounded overflow-hidden shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-1.5 px-4 py-3 bg-primary/5 border-b border-primary/10">
              <div className="w-3 h-3 rounded-full bg-primary/40" />
              <div className="w-3 h-3 rounded-full bg-primary/25" />
              <div className="w-3 h-3 rounded-full bg-primary/15" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">workflow_v3.json</span>
            </div>
            <pre className="p-4 text-xs font-mono text-muted-foreground overflow-hidden">
<span className="text-success">+ "nodes": [</span>
<span className="text-success">+   {"{"}"name": "Slack",</span>
<span className="text-success">+    "type": "n8n-nodes-base.slack"{"}"}</span>
<span className="text-success">+ ]</span>
<span className="text-muted-foreground/50">  "connections": {"{"}</span>
<span className="text-primary">-   "HTTP": {"{"} "main": [[]] {"}"}</span>
<span className="text-success">+   "HTTP": {"{"} "main": [["Slack"]] {"}"}</span>
<span className="text-muted-foreground/50">  {"}"}</span>
            </pre>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-y border-border/50 bg-card/30 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-medium text-primary mb-3 tracking-wider">HOW IT WORKS</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-12">
            {t('how.title')}
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { num: '01', title: t('how.step1.title'), desc: t('how.step1.desc') },
              { num: '02', title: t('how.step2.title'), desc: t('how.step2.desc') },
              { num: '03', title: t('how.step3.title'), desc: t('how.step3.desc') },
            ].map((step) => (
              <div key={step.num} className="group">
                <div className="text-4xl font-bold text-primary/20 group-hover:text-primary/40 transition-colors mb-4">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-medium text-primary mb-3 tracking-wider">FEATURES</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            {t('features.title')}
          </h2>
          <p className="text-sm text-muted-foreground mb-12 max-w-3xl">
            {t('features.subtitle')}
          </p>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="group p-5 rounded border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border transition-all"
              >
                <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-platform section */}
      <section className="relative border-y border-border/50 bg-card/30 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-medium text-primary mb-3 tracking-wider">MULTI-PLATFORM</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            One dashboard, all your platforms
          </h2>
          <p className="text-muted-foreground mb-12 max-w-2xl">
            Whether you use n8n, Make, or Activepieces — FlowVault provides a unified interface 
            to manage, version, and monitor all your workflows.
          </p>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {platforms.filter(p => !p.soon).map((platform) => (
              <div 
                key={platform.name}
                className="p-6 rounded border border-border/50 bg-card/50 hover:bg-card transition-all"
              >
                <div className={`w-12 h-12 rounded-lg ${platform.color} flex items-center justify-center text-2xl mb-4`}>
                  {platform.icon}
                </div>
                <h3 className="font-semibold mb-2">{platform.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Full support for workflow versioning, diffs, rollbacks, and error tracking.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing */}
      <section className="relative border-y border-border/50 bg-card/20 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-medium text-primary mb-3 tracking-wider">MARKETING</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Spread the word while you ship
          </h2>
          <p className="text-sm text-muted-foreground mb-12 max-w-3xl">
            Use our ready-made content kits to tease new automations, attract consulting leads, or reassure stakeholders.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {marketingHighlights.map((item) => (
              <div key={item.title} className="p-6 rounded border border-border/50 bg-background/70">
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                <Link href={item.href} className="text-sm font-medium text-primary hover:underline">
                  {item.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative p-8 sm:p-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 overflow-hidden">
            <div className="absolute inset-0 dot-pattern opacity-20" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-primary-foreground">
                Ready to protect your workflows?
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-md">
                Join developers who never worry about breaking their automation workflows.
              </p>
              <Link href="/auth/login">
                <Button size="lg" variant="secondary" className="h-11 px-6 bg-white text-primary hover:bg-white/90">
                  Get started free <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
              <Vault className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm font-medium">FlowVault</span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal/legal-notice" className="hover:text-foreground transition-colors">
              Legal notice
            </Link>
            <Link href="/legal/dpa" className="hover:text-foreground transition-colors">
              DPA
            </Link>
          </div>
          <p className="text-xs text-muted-foreground text-left sm:text-right">
            The vault for your automation workflows 🔐
          </p>
        </div>
      </footer>
    </div>
  );
}
