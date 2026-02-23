import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Square, RotateCw, Settings2, Plus, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { api, type DnsStatus, type DnsAvailableTarget } from '~/lib/api';

export const Route = createFileRoute('/dns')({
  component: DnsPage,
});

function DnsPage() {
  const [dnsStatus, setDnsStatus] = useState<DnsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await api.dns.status();
      setDnsStatus(status);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const result = await api.dns.action(action);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await refresh();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || `Failed to ${action} dnsmasq` });
    } finally {
      setActionLoading('');
    }
  };

  const handleAddRecord = async (hostname: string, ip: string) => {
    try {
      const result = await api.dns.addRecord(hostname, ip);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await refresh();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to add record' });
    }
  };

  const handleDeleteRecord = async (hostname: string, ip: string) => {
    try {
      const result = await api.dns.deleteRecord(hostname, ip);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await refresh();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to delete record' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const dnsmasq = dnsStatus?.dnsmasq;
  const records = dnsStatus?.records || [];
  const availableTargets = dnsStatus?.availableTargets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DNS</h1>
          <p className="text-muted-foreground">Manage dnsmasq and DNS records</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* dnsmasq status card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">dnsmasq Service</CardTitle>
          <CardDescription>
            DNS server listening on the WireGuard interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={dnsmasq?.installed ? 'success' : 'destructive'}>
              {dnsmasq?.installed ? 'Installed' : 'Not Installed'}
            </Badge>
            <Badge variant={dnsmasq?.running ? 'success' : 'secondary'}>
              {dnsmasq?.running ? 'Running' : 'Stopped'}
            </Badge>
            <Badge variant={dnsmasq?.configExists ? 'success' : 'secondary'}>
              {dnsmasq?.configExists ? 'Configured' : 'Not Configured'}
            </Badge>
            {dnsmasq?.version && (
              <span className="text-xs text-muted-foreground">v{dnsmasq.version}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!dnsmasq?.configExists ? (
              <Button
                onClick={() => handleAction('setup')}
                disabled={!!actionLoading}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                {actionLoading === 'setup' ? 'Setting up...' : dnsmasq?.installed ? 'Setup DNS' : 'Install & Setup DNS'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleAction('start')}
                  disabled={!!actionLoading || !!dnsmasq?.running}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {actionLoading === 'start' ? 'Starting...' : 'Start'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('stop')}
                  disabled={!!actionLoading || !dnsmasq?.running}
                >
                  <Square className="h-4 w-4 mr-2" />
                  {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction('restart')}
                  disabled={!!actionLoading}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
                </Button>
              </>
            )}
          </div>

          {!dnsmasq?.installed && !dnsmasq?.configExists && (
            <p className="text-sm text-muted-foreground">
              dnsmasq is not installed. Click "Install & Setup DNS" to install and configure it automatically.
            </p>
          )}
        </CardContent>
      </Card>

      {/* DNS Records card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base">DNS Records</CardTitle>
            <CardDescription>
              Custom hostname to IP mappings stored in dnsmasq config
            </CardDescription>
          </div>
          <Button
            onClick={() => setAddDialogOpen(true)}
            disabled={!dnsmasq?.configExists}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Hostname</th>
                  <th className="px-4 py-3 text-left font-medium">IP Address</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No DNS records configured. Click "Add Record" to create one.
                    </td>
                  </tr>
                ) : (
                  records.map((record, i) => (
                    <tr key={i} className="border-b transition-colors hover:bg-muted/50">
                      <td className="px-4 py-2.5 font-mono">{record.hostname}</td>
                      <td className="px-4 py-2.5 font-mono">{record.ip}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRecord(record.hostname, record.ip)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Record Dialog */}
      <AddRecordDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddRecord}
        availableTargets={availableTargets}
      />
    </div>
  );
}

function AddRecordDialog({
  open,
  onClose,
  onSubmit,
  availableTargets,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (hostname: string, ip: string) => Promise<void>;
  availableTargets: DnsAvailableTarget[];
}) {
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim() || !ip) return;

    setSaving(true);
    try {
      await onSubmit(hostname.trim(), ip);
      setHostname('');
      setIp('');
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add DNS Record</DialogTitle>
            <DialogDescription>
              Map a hostname to a VPN IP address.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hostname">Hostname</Label>
              <Input
                id="hostname"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="e.g. media.vpn"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">IP Address</Label>
              <Select value={ip} onValueChange={setIp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a VPN IP" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((target) => (
                    <SelectItem key={target.ip} value={target.ip}>
                      {target.name} ({target.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !hostname.trim() || !ip}>
              {saving ? 'Adding...' : 'Add Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
