'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore, useToastStore } from '@/lib/store';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { setAuth } = useAuthStore();
  const { addToast } = useToastStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError('Missing verification token');
        setLoading(false);
        return;
      }

      try {
        const result = await authApi.verifyToken(token);
        
        // Get user with organizations
        const me = await authApi.getMe(result.token);
        
        setAuth(result.token, me.user, me.organizations);
        
        addToast({
          title: 'Welcome!',
          description: 'You have been signed in successfully',
          variant: 'success',
        });

        // Redirect based on whether they have orgs
        if (me.organizations.length > 0) {
          router.push('/app');
        } else {
          router.push('/app/onboarding');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setLoading(false);
      }
    }

    verify();
  }, [token, setAuth, addToast, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <CardTitle>Verifying...</CardTitle>
            <CardDescription>Please wait while we sign you in</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Verification failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => router.push('/auth/login')}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}



