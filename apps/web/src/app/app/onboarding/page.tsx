'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { History, Loader2 } from 'lucide-react';
import { orgApi } from '@/lib/api';
import { useAuthStore, useToastStore } from '@/lib/store';

export default function OnboardingPage() {
  const router = useRouter();
  const { token, setOrganizations, setCurrentOrg } = useAuthStore();
  const { addToast } = useToastStore();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);

    try {
      const org = await orgApi.create(token, name);
      
      setOrganizations([{ id: org.id, name: org.name, role: 'owner' }]);
      setCurrentOrg(org.id);

      addToast({
        title: 'Organization created!',
        description: `Welcome to ${org.name}`,
        variant: 'success',
      });

      router.push('/app');
    } catch (error) {
      addToast({
        title: 'Failed to create organization',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <History className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Create your organization</CardTitle>
          <CardDescription>
            Organizations help you organize your n8n instances and team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                placeholder="My Company"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}



