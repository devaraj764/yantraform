import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ShieldCheck,
  Plus,
  Trash2,
  ShieldAlert,
  ShieldOff,
  CircleCheck,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { api, type FirewallStatus, type FirewallRule, type ServerStatus } from '~/lib/api';

export const Route = createFileRoute('/firewall')({
  component: FirewallPage,
});

// Well-known critical ports that should not be removed
const CRITICAL_PORTS: Record<number, string> = {
  22: 'SSH',
  51821: 'Dashboard',
};

// Well-known service ports that warrant caution
const CAUTION_PORTS: Record<number, string> = {
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  25: 'SMTP',
  3306: 'MySQL',
  5432: 'PostgreSQL',
};

type SafetyLevel = 'critical' | 'caution' | 'safe';

function getPortSafety(
  port: number,
  protocol: string,
  wgPort: number,
): { level: SafetyLevel; reason: string } {
  if (port === wgPort && protocol === 'udp') {
    return { level: 'critical', reason: 'Yantraform VPN' };
  }
  if (CRITICAL_PORTS[port]) {
    return { level: 'critical', reason: CRITICAL_PORTS[port] };
  }
  if (CAUTION_PORTS[port]) {
    return { level: 'caution', reason: CAUTION_PORTS[port] };
  }
  return { level: 'safe', reason: '' };
}

function SafetyBadge({ level, reason }: { level: SafetyLevel; reason: string }) {
  switch (level) {
    case 'critical':
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
          <ShieldAlert className="h-3 w-3" />
          {reason}
        </Badge>
      );
    case 'caution':
      return (
        <Badge variant="warning" className="text-[10px] px-1.5 py-0 gap-1">
          <ShieldOff className="h-3 w-3" />
          {reason}
        </Badge>
      );
    case 'safe':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-green-600 border-green-300">
          <CircleCheck className="h-3 w-3" />
          Safe to remove
        </Badge>
      );
  }
}

function ruleKey(port: number, protocol: string) {
  return `${protocol}-${port}`;
}

function FirewallPage() {
  const [firewallStatus, setFirewallStatus] = useState<FirewallStatus | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<{ port: number; protocol: 'tcp' | 'udp' } | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [fw, srv] = await Promise.all([
        api.server.firewall(),
        api.server.status(),
      ]);
      setFirewallStatus(fw);
      setServerStatus(srv);
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

  const handleAddPort = async (port: number, protocol: 'tcp' | 'udp') => {
    try {
      const result = await api.server.addFirewallPort(port, protocol);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        handleRefresh();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to add port' });
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    try {
      const result = await api.server.removeFirewallPort(deletingRule.port, deletingRule.protocol);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(ruleKey(deletingRule.port, deletingRule.protocol));
          return next;
        });
        handleRefresh();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to remove rule' });
    } finally {
      setDeletingRule(null);
    }
  };

  const handleDeleteSelected = async () => {
    const entries = Array.from(selected).map((key) => {
      const [protocol, port] = key.split('-');
      return { port: parseInt(port, 10), protocol: protocol as 'tcp' | 'udp' };
    });
    const errors: string[] = [];
    let successCount = 0;
    for (const entry of entries) {
      try {
        const result = await api.server.removeFirewallPort(entry.port, entry.protocol);
        if (result.success) {
          successCount++;
        } else {
          errors.push(`${entry.port}/${entry.protocol}: ${result.message}`);
        }
      } catch (err: any) {
        errors.push(`${entry.port}/${entry.protocol}: ${err?.message || 'Failed'}`);
      }
    }
    setSelected(new Set());
    setDeletingSelected(false);
    if (errors.length > 0) {
      setMessage({ type: 'error', text: `Removed ${successCount}, failed ${errors.length}: ${errors[0]}` });
    } else {
      setMessage({ type: 'success', text: `Removed ${successCount} rule${successCount !== 1 ? 's' : ''}` });
    }
    handleRefresh();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const firewall = firewallStatus?.firewall;
  const parsedRules = firewallStatus?.parsedRules || [];
  const rawRules = firewallStatus?.rules || '';
  const wgPort = serverStatus?.listenPort || 51820;
  const noFirewall = firewall?.type === 'none';

  const allowRules = parsedRules.filter((r) => r.action === 'allow');
  const denyRules = parsedRules.filter((r) => r.action !== 'allow');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Firewall Rules</h1>
          <p className="text-muted-foreground">Manage firewall port rules</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={() => setDeletingSelected(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selected.size})
            </Button>
          )}
          <Button onClick={() => setAddDialogOpen(true)} disabled={noFirewall}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
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

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Firewall</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{firewall?.type || 'None'}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={firewall?.active ? 'success' : 'destructive'}>
                {firewall?.active ? 'Active' : 'Inactive'}
              </Badge>
              {firewall?.version && (
                <span className="text-xs text-muted-foreground">v{firewall.version}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Allow Rules</CardTitle>
            <CircleCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allowRules.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {denyRules.length} deny/reject / {parsedRules.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">VPN Port</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wgPort}/udp</div>
            <div className="mt-1">
              <Badge variant={parsedRules.some((r) => r.port === wgPort && r.protocol === 'udp' && r.action === 'allow') ? 'success' : 'warning'}>
                {parsedRules.some((r) => r.port === wgPort && r.protocol === 'udp' && r.action === 'allow') ? 'Allowed' : 'Not Allowed'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dashboard Port</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">51821/tcp</div>
            <div className="mt-1">
              <Badge variant={parsedRules.some((r) => r.port === 51821 && r.protocol === 'tcp' && r.action === 'allow') ? 'success' : 'warning'}>
                {parsedRules.some((r) => r.port === 51821 && r.protocol === 'tcp' && r.action === 'allow') ? 'Allowed' : 'Not Allowed'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules table */}
      <Card>
        <CardContent className="p-0">
          <RulesTable
            rules={parsedRules}
            wgPort={wgPort}
            noFirewall={noFirewall}
            selected={selected}
            onSelectionChange={setSelected}
            onDelete={(port, protocol) => setDeletingRule({ port, protocol })}
          />
        </CardContent>
      </Card>

      {/* Raw rules collapsible */}
      {rawRules && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            Show raw firewall output
          </summary>
          <Card className="mt-2">
            <CardContent className="p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs font-mono">
                {rawRules}
              </pre>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Add Port Dialog */}
      <AddPortDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddPort}
      />

      {/* Delete Single Rule Confirmation */}
      <AlertDialog open={!!deletingRule} onOpenChange={(v) => !v && setDeletingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Firewall Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the allow rule for port{' '}
              <strong>{deletingRule?.port}/{deletingRule?.protocol}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Rules Confirmation */}
      <AlertDialog open={deletingSelected} onOpenChange={(v) => !v && setDeletingSelected(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selected.size} Rule{selected.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selected.size} selected firewall rule{selected.size !== 1 ? 's' : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove {selected.size} Rule{selected.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddPortDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (port: number, protocol: 'tcp' | 'udp') => Promise<void>;
}) {
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState<'tcp' | 'udp' | 'both'>('tcp');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return;

    setSaving(true);
    try {
      if (protocol === 'both') {
        await onSubmit(portNum, 'tcp');
        await onSubmit(portNum, 'udp');
      } else {
        await onSubmit(portNum, protocol);
      }
      setPort('');
      setProtocol('tcp');
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
            <DialogTitle>Add Firewall Rule</DialogTitle>
            <DialogDescription>
              Allow incoming traffic on a port through the firewall.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="port">Port Number</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="e.g. 8080"
                min={1}
                max={65535}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as 'tcp' | 'udp' | 'both')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="both">Both (TCP + UDP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !port}>
              {saving ? 'Adding...' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RulesTable({
  rules,
  wgPort,
  noFirewall,
  selected,
  onSelectionChange,
  onDelete,
}: {
  rules: FirewallRule[];
  wgPort: number;
  noFirewall: boolean;
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onDelete: (port: number, protocol: 'tcp' | 'udp') => void;
}) {
  const canManage = !noFirewall;

  // Only safe allow-rules can be selected
  const selectableRules = rules.filter(
    (r) => r.action === 'allow' && getPortSafety(r.port, r.protocol, wgPort).level === 'safe',
  );
  const allSelectableKeys = selectableRules.map((r) => ruleKey(r.port, r.protocol));
  const allChecked = allSelectableKeys.length > 0 && allSelectableKeys.every((k) => selected.has(k));
  const someChecked = allSelectableKeys.some((k) => selected.has(k));

  const handleToggleAll = () => {
    const next = new Set(selected);
    if (allChecked) {
      for (const k of allSelectableKeys) next.delete(k);
    } else {
      for (const k of allSelectableKeys) next.add(k);
    }
    onSelectionChange(next);
  };

  const handleToggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {canManage && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = !!(someChecked && !allChecked); }}
                  onChange={handleToggleAll}
                  aria-label="Select all safe rules"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left font-medium">Port</th>
            <th className="px-4 py-3 text-left font-medium">Protocol</th>
            <th className="px-4 py-3 text-left font-medium">Action</th>
            <th className="px-4 py-3 text-left font-medium">Safety</th>
            {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 6 : 4} className="px-4 py-8 text-center text-muted-foreground">
                {noFirewall ? 'No firewall detected' : 'No firewall rules found'}
              </td>
            </tr>
          ) : (
            rules.map((r) => {
              const safety = getPortSafety(r.port, r.protocol, wgPort);
              const key = ruleKey(r.port, r.protocol);
              const isSafe = safety.level === 'safe' && r.action === 'allow';
              const isWgPort = r.port === wgPort && r.protocol === 'udp';
              const isDashboardPort = r.port === 51821 && r.protocol === 'tcp';
              return (
                <tr
                  key={key}
                  className={`border-b transition-colors hover:bg-muted/50 ${isWgPort || isDashboardPort ? 'bg-primary/5' : ''} ${selected.has(key) ? 'bg-primary/10' : ''}`}
                >
                  {canManage && (
                    <td className="w-10 px-4 py-2.5">
                      {isSafe ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
                          checked={selected.has(key)}
                          onChange={() => handleToggle(key)}
                          aria-label={`Select rule ${r.port}/${r.protocol}`}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 opacity-30 cursor-not-allowed"
                          disabled
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5 font-mono">
                    {r.port}
                    {isWgPort && (
                      <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">
                        WG
                      </Badge>
                    )}
                    {isDashboardPort && (
                      <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">
                        Dashboard
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.protocol.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.action === 'allow' ? 'success' : 'destructive'} className="text-xs">
                      {r.action.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <SafetyBadge level={safety.level} reason={safety.reason} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      {isSafe && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(r.port, r.protocol)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
