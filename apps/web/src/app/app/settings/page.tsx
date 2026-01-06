'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore, useToastStore } from '@/lib/store';
import { settingsApi, orgApi } from '@/lib/api';
import { Loader2, Bell, Building2, Save, TestTube2, Trash2, Check, ShieldCheck, KeyRound } from 'lucide-react';

export default function SettingsPage() {
  const { token, currentOrgId, organizations, setOrganizations } = useAuthStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [hasSlackWebhook, setHasSlackWebhook] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [showSlackInput, setShowSlackInput] = useState(false);
  const [hasTeamsWebhook, setHasTeamsWebhook] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [showTeamsInput, setShowTeamsInput] = useState(false);
  const [hasCustomWebhook, setHasCustomWebhook] = useState(false);
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [alertEmailsInput, setAlertEmailsInput] = useState('');
  const [savedAlertEmails, setSavedAlertEmails] = useState<string[]>([]);
  const [ssoProvider, setSsoProvider] = useState('generic');
  const [ssoDomain, setSsoDomain] = useState('');
  const [ssoIssuerUrl, setSsoIssuerUrl] = useState('');
  const [ssoLoginUrl, setSsoLoginUrl] = useState('');
  const [ssoAudience, setSsoAudience] = useState('');
  const [ssoDefaultRole, setSsoDefaultRole] = useState<'member' | 'owner'>('member');
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoEnforce, setSsoEnforce] = useState(false);
  const [ssoSharedSecret, setSsoSharedSecret] = useState('');
  const [ssoHasSecret, setSsoHasSecret] = useState(false);
  const [savingSso, setSavingSso] = useState(false);
  const [testingSso, setTestingSso] = useState(false);
  const [ssoTestResult, setSsoTestResult] = useState<{
    payload: { email: string; externalId: string; timestamp: string; nonce: string };
    signature: string;
    callbackUrl: string;
    instructions: string;
  } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!token || !currentOrgId) return;

      try {
        const settings = await settingsApi.get(token, currentOrgId);
        setOrgName(settings.organizationName || '');
        setHasSlackWebhook(settings.hasSlackWebhook);
        setHasTeamsWebhook(settings.hasTeamsWebhook);
        setHasCustomWebhook(settings.hasCustomWebhook);
        setSavedAlertEmails(settings.alertEmails || []);
        setAlertEmailsInput(settings.alertEmails?.join(', ') || '');
        if (settings.ssoConfig) {
          setSsoProvider(settings.ssoConfig.provider || 'generic');
          setSsoDomain(settings.ssoConfig.domainHint || '');
          setSsoIssuerUrl(settings.ssoConfig.issuerUrl || '');
          setSsoLoginUrl(settings.ssoConfig.loginUrl || '');
          setSsoAudience(settings.ssoConfig.audience || '');
          setSsoDefaultRole((settings.ssoConfig.defaultRole as 'member' | 'owner') || 'member');
          setSsoEnabled(settings.ssoConfig.enabled);
          setSsoEnforce(settings.ssoConfig.enforceForAll);
          setSsoHasSecret(settings.ssoConfig.hasSharedSecret);
        } else {
          setSsoProvider('generic');
          setSsoDomain('');
          setSsoIssuerUrl('');
          setSsoLoginUrl('');
          setSsoAudience('');
          setSsoDefaultRole('member');
          setSsoEnabled(false);
          setSsoEnforce(false);
          setSsoHasSecret(false);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        addToast({ title: 'Failed to load settings', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [token, currentOrgId, addToast]);

  const handleSaveOrgName = async () => {
    if (!token || !currentOrgId) return;

    setSaving(true);

    try {
      await orgApi.update(token, currentOrgId, orgName);
      setOrganizations(
        organizations.map((o) => (o.id === currentOrgId ? { ...o, name: orgName } : o))
      );
      addToast({ title: 'Organization name updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update organization',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlackWebhook = async () => {
    if (!token || !currentOrgId) return;

    setSaving(true);

    try {
      await settingsApi.update(token, currentOrgId, {
        slackWebhookUrl: slackWebhookUrl || null,
      });
      setHasSlackWebhook(!!slackWebhookUrl);
      setSlackWebhookUrl('');
      setShowSlackInput(false);
      addToast({ title: 'Slack webhook updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update Slack webhook',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSlackWebhook = async () => {
    if (!token || !currentOrgId) return;
    if (!confirm('Remove Slack webhook integration?')) return;

    try {
      await settingsApi.update(token, currentOrgId, { slackWebhookUrl: null });
      setHasSlackWebhook(false);
      addToast({ title: 'Slack webhook removed', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to remove Slack webhook',
        variant: 'destructive',
      });
    }
  };

  const handleSaveTeamsWebhook = async () => {
    if (!token || !currentOrgId) return;

    setSaving(true);

    try {
      await settingsApi.update(token, currentOrgId, {
        teamsWebhookUrl: teamsWebhookUrl || null,
      });
      setHasTeamsWebhook(!!teamsWebhookUrl);
      setTeamsWebhookUrl('');
      setShowTeamsInput(false);
      addToast({ title: 'Teams webhook updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update Teams webhook',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTeamsWebhook = async () => {
    if (!token || !currentOrgId) return;
    if (!confirm('Remove Teams webhook integration?')) return;

    try {
      await settingsApi.update(token, currentOrgId, { teamsWebhookUrl: null });
      setHasTeamsWebhook(false);
      addToast({ title: 'Teams webhook removed', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to remove Teams webhook',
        variant: 'destructive',
      });
    }
  };

  const handleSaveCustomWebhook = async () => {
    if (!token || !currentOrgId) return;

    setSaving(true);

    try {
      await settingsApi.update(token, currentOrgId, {
        customWebhookUrl: customWebhookUrl || null,
      });
      setHasCustomWebhook(!!customWebhookUrl);
      setCustomWebhookUrl('');
      setShowCustomInput(false);
      addToast({ title: 'Webhook updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update webhook',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCustomWebhook = async () => {
    if (!token || !currentOrgId) return;
    if (!confirm('Remove custom webhook?')) return;

    try {
      await settingsApi.update(token, currentOrgId, { customWebhookUrl: null });
      setHasCustomWebhook(false);
      addToast({ title: 'Webhook removed', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to remove webhook',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAlertEmails = async () => {
    if (!token || !currentOrgId) return;

    setSaving(true);
    const normalized = alertEmailsInput
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0);

    try {
      await settingsApi.update(token, currentOrgId, {
        alertEmails: normalized,
      });
      setSavedAlertEmails(normalized);
      addToast({ title: 'Email alerts updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update email alerts',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotifications = async () => {
    if (!token || !currentOrgId) return;

    setTestingNotifications(true);

    try {
      const result = await settingsApi.testNotifications(token, currentOrgId);
      if (result.success) {
        addToast({ title: 'Test message sent!', variant: 'success' });
      } else {
        addToast({ title: 'Test failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      addToast({
        title: 'Test failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setTestingNotifications(false);
    }
  };

  const handleSaveSso = async () => {
    if (!token || !currentOrgId) return;
    setSavingSso(true);
    try {
      await settingsApi.update(token, currentOrgId, {
        ssoConfig: {
          provider: ssoProvider,
          domainHint: ssoDomain || null,
          issuerUrl: ssoIssuerUrl || null,
          loginUrl: ssoLoginUrl || null,
          audience: ssoAudience || null,
          defaultRole: ssoDefaultRole,
          enforceForAll: ssoEnforce,
          enabled: ssoEnabled,
          sharedSecret: ssoSharedSecret || undefined,
        },
      });
      if (ssoSharedSecret) {
        setSsoHasSecret(true);
        setSsoSharedSecret('');
      }
      addToast({ title: 'SSO settings updated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to update SSO',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSavingSso(false);
    }
  };

  const handleTestSso = async () => {
    if (!token || !currentOrgId) return;
    setTestingSso(true);
    try {
      const result = await settingsApi.testSso(token, currentOrgId);
      setSsoTestResult(result);
      addToast({ title: 'SSO signature generated', variant: 'success' });
    } catch (error) {
      addToast({
        title: 'Failed to test SSO',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setTestingSso(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle>Organization</CardTitle>
          </div>
          <CardDescription>Manage your organization settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <div className="flex gap-2">
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
              />
              <Button onClick={handleSaveOrgName} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure the channels that should receive alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Slack Webhook</p>
                <p className="text-sm text-muted-foreground">Send alerts to a Slack channel</p>
              </div>
              {hasSlackWebhook ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
            {hasSlackWebhook && !showSlackInput ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSlackInput(true)}>
                  Update
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSlackWebhook}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                <Input
                  id="slackWebhook"
                  type="url"
                  placeholder="https://hooks.slack.com/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveSlackWebhook} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  {showSlackInput && (
                    <Button variant="ghost" size="sm" onClick={() => setShowSlackInput(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Microsoft Teams</p>
                <p className="text-sm text-muted-foreground">Post alerts to a Teams channel</p>
              </div>
              {hasTeamsWebhook ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
            {hasTeamsWebhook && !showTeamsInput ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTeamsInput(true)}>
                  Update
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveTeamsWebhook}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="teamsWebhook">Teams Webhook URL</Label>
                <Input
                  id="teamsWebhook"
                  type="url"
                  placeholder="https://..."
                  value={teamsWebhookUrl}
                  onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveTeamsWebhook} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  {showTeamsInput && (
                    <Button variant="ghost" size="sm" onClick={() => setShowTeamsInput(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-muted-foreground">Comma-separated list of recipients</p>
              </div>
              {savedAlertEmails.length > 0 ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="alertEmails">Alert recipients</Label>
              <Input
                id="alertEmails"
                placeholder="ops@team.com, dev@team.com"
                value={alertEmailsInput}
                onChange={(e) => setAlertEmailsInput(e.target.value)}
              />
              {savedAlertEmails.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Current: {savedAlertEmails.join(', ')}
                </p>
              )}
              <Button size="sm" onClick={handleSaveAlertEmails} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Custom Webhook</p>
                <p className="text-sm text-muted-foreground">Send JSON payloads to any HTTP endpoint</p>
              </div>
              {hasCustomWebhook ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
            {hasCustomWebhook && !showCustomInput ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCustomInput(true)}>
                  Update
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCustomWebhook}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="customWebhook">Webhook URL</Label>
                <Input
                  id="customWebhook"
                  type="url"
                  placeholder="https://..."
                  value={customWebhookUrl}
                  onChange={(e) => setCustomWebhookUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveCustomWebhook} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  {showCustomInput && (
                    <Button variant="ghost" size="sm" onClick={() => setShowCustomInput(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={handleTestNotifications} disabled={testingNotifications}>
              {testingNotifications && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              <TestTube2 className="w-3.5 h-3.5 mr-1" />
              Send test notification
            </Button>
          </div>
      </CardContent>
    </Card>

      {/* SSO */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle>Single Sign-On</CardTitle>
          </div>
          <CardDescription>Configure your enterprise SSO connector</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={ssoProvider} onValueChange={setSsoProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="okta">Okta</SelectItem>
                  <SelectItem value="azure">Azure AD</SelectItem>
                  <SelectItem value="google">Google Workspace</SelectItem>
                  <SelectItem value="onelogin">OneLogin</SelectItem>
                  <SelectItem value="generic">Generic SAML/OIDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default role</Label>
              <Select value={ssoDefaultRole} onValueChange={(value: 'member' | 'owner') => setSsoDefaultRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Domain hint</Label>
              <Input
                placeholder="example.com"
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Audience / Entity ID</Label>
              <Input
                placeholder="api://flowvault"
                value={ssoAudience}
                onChange={(e) => setSsoAudience(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Issuer metadata URL</Label>
              <Input
                type="url"
                placeholder="https://idp.example.com/metadata"
                value={ssoIssuerUrl}
                onChange={(e) => setSsoIssuerUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Login URL / ACS endpoint</Label>
              <Input
                type="url"
                placeholder="https://idp.example.com/login"
                value={ssoLoginUrl}
                onChange={(e) => setSsoLoginUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ssoEnabled} onCheckedChange={(checked) => setSsoEnabled(checked === true)} />
              Enable SSO for this organization
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ssoEnforce}
                onCheckedChange={(checked) => setSsoEnforce(checked === true)}
                disabled={!ssoEnabled}
              />
              Enforce SSO for all members
            </label>
          </div>
          <div className="space-y-2">
            <Label>
              Shared secret{' '}
              {ssoHasSecret && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  stored
                </Badge>
              )}
            </Label>
            <Input
              type="password"
              placeholder="Paste a new shared secret"
              value={ssoSharedSecret}
              onChange={(e) => setSsoSharedSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to keep the existing secret. This secret is used to sign assertion payloads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveSso} disabled={savingSso}>
              {savingSso && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Save SSO
            </Button>
            <Button
              variant="outline"
              onClick={handleTestSso}
              disabled={testingSso || !ssoHasSecret}
            >
              {testingSso && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              <KeyRound className="w-3.5 h-3.5 mr-1" />
              Generate test signature
            </Button>
          </div>
          {ssoTestResult && (
            <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm">
              <p className="font-medium mb-2">Test payload</p>
              <p className="text-muted-foreground">
                Signature: <code className="break-all">{ssoTestResult.signature}</code>
              </p>
              <p className="text-muted-foreground">
                Callback: <code className="break-all">{ssoTestResult.callbackUrl}</code>
              </p>
              <p className="text-muted-foreground">
                Payload: <code className="break-all">{JSON.stringify(ssoTestResult.payload)}</code>
              </p>
              <p className="text-xs text-muted-foreground mt-2">{ssoTestResult.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Organization</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this organization and all its data
              </p>
            </div>
            <Button
              variant="destructive"
              disabled
              title="Contact support to delete your organization"
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
