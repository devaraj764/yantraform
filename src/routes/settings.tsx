import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Play, Square, RotateCw, Save, Key, Lock, Locate, Info } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { api, type ServerStatus } from '~/lib/api';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

interface ServerConfigForm {
  server_interface: string;
  server_port: string;
  server_address: string;
  server_endpoint: string;
  server_local_ip: string;
  server_dns: string;
  server_post_up: string;
  server_post_down: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
}

function SettingsPage() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [publicKey, setPublicKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [configMessage, setConfigMessage] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [sshKeySaved, setSshKeySaved] = useState(false);
  const [sshSaving, setSshSaving] = useState(false);
  const [sshMessage, setSshMessage] = useState('');

  const configForm = useForm<ServerConfigForm>({
    defaultValues: {
      server_interface: '',
      server_port: '',
      server_address: '',
      server_endpoint: '',
      server_local_ip: '',
      server_dns: '',
      server_post_up: '',
      server_post_down: '',
    },
  });

  const pwForm = useForm<PasswordForm>({
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const refresh = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.server.status(), api.server.config()]);
      setStatus(s);
      setPublicKey(c.server_public_key || '');
      setSshKey(c.ssh_public_key || '');
      setSshKeySaved(!!c.ssh_public_key);
      configForm.reset({
        server_interface: c.server_interface || '',
        server_port: c.server_port || '',
        server_address: c.server_address || '',
        server_endpoint: c.server_endpoint || '',
        server_local_ip: c.server_local_ip || '',
        server_dns: c.server_dns || '',
        server_post_up: c.server_post_up || '',
        server_post_down: c.server_post_down || '',
      });
    } catch {} finally {
      setLoading(false);
    }
  }, [configForm]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-detect SSH key on first load if not already saved
  useEffect(() => {
    if (!loading && !sshKey) {
      handleDetectSshKey();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleSaveConfig = async (data: ServerConfigForm) => {
    setConfigMessage('');
    try {
      await api.server.updateConfig(data as unknown as Record<string, string>);
      configForm.reset(data);
      setConfigMessage('Settings saved');
      setTimeout(() => setConfigMessage(''), 3000);
    } catch {
      setConfigMessage('Failed to save');
    }
  };

  const handlePasswordChange = async (data: PasswordForm) => {
    try {
      const result = await api.auth.changePassword(data.currentPassword, data.newPassword);
      if (result.success) {
        pwForm.reset();
        pwForm.setError('root', { message: 'Password updated' });
      } else {
        pwForm.setError('root', { message: result.error || 'Failed' });
      }
    } catch {
      pwForm.setError('root', { message: 'Failed to update password' });
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    try {
      if (action === 'start') await api.server.start();
      else if (action === 'stop') await api.server.stop();
      else await api.server.restart();
      await refresh();
    } catch {} finally {
      setActionLoading('');
    }
  };

  const handleGenerateKeys = async () => {
    setActionLoading('keys');
    try {
      const force = !!publicKey;
      const result = await api.server.generateKeys(force);
      setPublicKey(result.publicKey);
      await refresh();
    } catch {} finally {
      setActionLoading('');
    }
  };

  const handleDetectSshKey = async () => {
    setSshSaving(true);
    setSshMessage('');
    try {
      const result = await api.server.detectSshKey();
      setSshKey(result.key);
      setSshKeySaved(true);
      setSshMessage(result.generated ? 'Key generated and saved' : 'Key detected and saved');
      setTimeout(() => setSshMessage(''), 3000);
    } catch {
      setSshMessage('Failed to detect/generate SSH key');
    } finally {
      setSshSaving(false);
    }
  };

  const handleSaveSshKey = async () => {
    setSshSaving(true);
    setSshMessage('');
    try {
      await api.server.updateConfig({ ssh_public_key: sshKey.trim() });
      setSshKeySaved(true);
      setSshMessage('SSH key saved');
      setTimeout(() => setSshMessage(''), 3000);
    } catch {
      setSshMessage('Failed to save');
    } finally {
      setSshSaving(false);
    }
  };

  const handleDetectIp = async (type: 'public' | 'local') => {
    const loadingKey = type === 'public' ? 'detect-ip' : 'detect-local-ip';
    setActionLoading(loadingKey);
    try {
      const result = type === 'public'
        ? await api.server.publicIp()
        : await api.server.localIp();
      if (result.ip) {
        const field = type === 'public' ? 'server_endpoint' : 'server_local_ip';
        configForm.setValue(field, result.ip, { shouldDirty: true });
      } else {
        setConfigMessage(result.error || `Could not detect ${type} IP`);
        setTimeout(() => setConfigMessage(''), 3000);
      }
    } catch {
      setConfigMessage(`Failed to detect ${type} IP`);
      setTimeout(() => setConfigMessage(''), 3000);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const { isDirty, isSubmitting } = configForm.formState;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Server configuration and controls</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server Controls</CardTitle>
          <CardDescription>
            Status:{' '}
            <Badge variant={status?.running ? 'success' : 'destructive'}>
              {status?.running ? 'Running' : 'Stopped'}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleAction('start')} disabled={!!actionLoading || !!status?.running}>
            <Play className="h-4 w-4 mr-2" />
            {actionLoading === 'start' ? 'Starting...' : 'Start'}
          </Button>
          <Button variant="outline" onClick={() => handleAction('stop')} disabled={!!actionLoading || !status?.running}>
            <Square className="h-4 w-4 mr-2" />
            {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
          </Button>
          <Button variant="outline" onClick={() => handleAction('restart')} disabled={!!actionLoading}>
            <RotateCw className="h-4 w-4 mr-2" />
            {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server Keys</CardTitle>
          <CardDescription>
            {publicKey ? 'Keys are configured' : 'No keys generated yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicKey && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Public Key</Label>
                <p className="font-mono text-xs break-all bg-muted p-2 rounded-md mt-1">
                  {publicKey}
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 p-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  If the VPN is not working for peers, try regenerating the keys and restarting the server, then re-add your peers.
                </p>
              </div>
            </>
          )}
          <Button variant="outline" onClick={handleGenerateKeys} disabled={!!actionLoading}>
            <Key className="h-4 w-4 mr-2" />
            {actionLoading === 'keys' ? 'Generating...' : publicKey ? 'Regenerate Keys' : 'Generate Keys'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SSH Public Key</CardTitle>
          <CardDescription>
            Used by peer setup scripts to authorize SSH access from this server. Auto-detected on load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sshKeySaved ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Public Key</Label>
                <p className="font-mono text-xs break-all bg-muted p-2 rounded-md mt-1">{sshKey}</p>
              </div>
              {sshMessage && <span className="text-sm text-muted-foreground">{sshMessage}</span>}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No SSH key configured.</p>
              <div className="space-y-2">
                <Label htmlFor="ssh-key">Paste manually (optional)</Label>
                <Input
                  id="ssh-key"
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA... user@host"
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" onClick={handleDetectSshKey} disabled={sshSaving}>
                  <Key className="h-4 w-4 mr-2" />
                  {sshSaving ? 'Detecting...' : 'Detect / Generate Key'}
                </Button>
                <Button variant="outline" onClick={handleSaveSshKey} disabled={sshSaving || !sshKey}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Manually
                </Button>
                {sshMessage && <span className="text-sm text-muted-foreground">{sshMessage}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server Configuration</CardTitle>
          <CardDescription>Yantraform interface settings</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={configForm.handleSubmit(handleSaveConfig)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="iface">Interface Name</Label>
                <Input id="iface" {...configForm.register('server_interface')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Listen Port</Label>
                <Input id="port" {...configForm.register('server_port')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Server Address</Label>
                <Input id="address" {...configForm.register('server_address')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endpoint">Public Endpoint</Label>
                <div className="flex gap-2">
                  <Input id="endpoint" {...configForm.register('server_endpoint')} placeholder="vpn.example.com" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    disabled={actionLoading === 'detect-ip'}
                    onClick={() => handleDetectIp('public')}
                    title="Detect public IP"
                  >
                    <Locate className={`h-4 w-4 ${actionLoading === 'detect-ip' ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-ip">Local IP Address</Label>
                <div className="flex gap-2">
                  <Input id="local-ip" {...configForm.register('server_local_ip')} placeholder="192.168.1.x" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    disabled={actionLoading === 'detect-local-ip'}
                    onClick={() => handleDetectIp('local')}
                    title="Detect local IP"
                  >
                    <Locate className={`h-4 w-4 ${actionLoading === 'detect-local-ip' ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns">DNS Servers</Label>
                <Input id="dns" {...configForm.register('server_dns')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="postup">Post Up Script</Label>
                <Input id="postup" {...configForm.register('server_post_up')} className="font-mono text-xs" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="postdown">Post Down Script</Label>
                <Input id="postdown" {...configForm.register('server_post_down')} className="font-mono text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!isDirty || isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Configuration'}
              </Button>
              {configMessage && <span className="text-sm text-muted-foreground">{configMessage}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Update the admin login password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={pwForm.handleSubmit(handlePasswordChange)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="curpw">Current Password</Label>
                <Input id="curpw" type="password" {...pwForm.register('currentPassword', { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newpw">New Password</Label>
                <Input id="newpw" type="password" {...pwForm.register('newPassword', { required: true })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="outline" disabled={!pwForm.formState.isDirty || pwForm.formState.isSubmitting}>
                <Lock className="h-4 w-4 mr-2" />
                {pwForm.formState.isSubmitting ? 'Changing...' : 'Change Password'}
              </Button>
              {pwForm.formState.errors.root && (
                <span className="text-sm text-muted-foreground">{pwForm.formState.errors.root.message}</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
