'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useToastStore } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoDetails, setSsoDetails] = useState<{
    provider: string;
    redirectUrl: string | null;
    nonce: string;
    expiresAt: string;
    callbackUrl: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authApi.requestMagicLink(email);
      setSent(true);
      addToast({
        title: 'Magic link sent!',
        description: 'Check your email (or console in dev mode)',
        variant: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Failed to send magic link',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async () => {
    if (!email) {
      addToast({ title: 'Enter your email', variant: 'destructive' });
      return;
    }
    setSsoLoading(true);
    try {
      const response = await authApi.startSso(email);
      setSsoDetails(response);
      addToast({
        title: 'SSO request created',
        description: response.redirectUrl
          ? 'Redirection vers votre fournisseur SSO...'
          : 'Partagez les détails de la requête avec votre IdP.',
        variant: 'success',
      });
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
      }
    } catch (error) {
      addToast({
        title: 'SSO unavailable',
        description:
          error instanceof Error ? error.message : 'Contactez votre administrateur.',
        variant: 'destructive',
      });
    } finally {
      setSsoLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <History className="w-6 h-6 text-success" />
            </div>
            <CardTitle>{t('auth.login.sent')}</CardTitle>
            <CardDescription>
              {t('auth.login.sentDesc')} <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Click the link in the email to sign in. In development mode, check the API console output.
            </p>
            <Button variant="outline" onClick={() => setSent(false)}>
              {t('auth.login.tryAnother')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <History className="w-6 h-6 text-primary-foreground" />
            </div>
          </Link>
          <CardTitle className="text-2xl">{t('auth.login.title')}</CardTitle>
          <CardDescription>
            {t('auth.login.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Magic Link
            </Button>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-3">
              <span className="flex-1 h-px bg-border" />
              <span>OU</span>
              <span className="flex-1 h-px bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={ssoLoading}
              onClick={handleSso}
            >
              {ssoLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Continue with enterprise SSO
            </Button>
            {ssoDetails && (
              <div className="mt-4 text-xs text-left rounded-lg border border-dashed border-muted-foreground/40 p-3 bg-muted/40">
                <p className="font-medium text-foreground">SSO request pending</p>
                <p className="text-muted-foreground mt-1">
                  Provider: <strong>{ssoDetails.provider}</strong>
                </p>
                <p className="text-muted-foreground">
                  Nonce: <code className="break-all">{ssoDetails.nonce}</code>
                </p>
                <p className="text-muted-foreground">
                  Callback: <code className="break-all">{ssoDetails.callbackUrl}</code>
                </p>
                <p className="text-muted-foreground">
                  Expires: {new Date(ssoDetails.expiresAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Don&apos;t have an account?{' '}
              <span className="text-primary">Sign up automatically on first login</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

