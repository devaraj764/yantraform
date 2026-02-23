import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Key,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Wifi,
  Globe,
  ArrowDown,
  ArrowUp,
  Clock,
  MapPin,
  Server,
  Copy,
  Check,
  Download,
  Terminal,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';
import { Card, CardContent } from '~/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { PeerForm } from '~/components/PeerForm';
import { TrafficChart } from '~/components/TrafficChart';
import { AgentPanel } from '~/components/AgentPanel';
import { api, type PeerWithStats } from '~/lib/api';
import { formatBytes, formatTimeAgo } from '~/lib/utils';

export const Route = createFileRoute('/servers')({
  component: ServersPage,
});

function ServersPage() {
  const [peers, setPeers] = useState<PeerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingPeer, setEditingPeer] = useState<PeerWithStats | null>(null);
  const [deletingPeer, setDeletingPeer] = useState<PeerWithStats | null>(null);
  const [setupPeer, setSetupPeer] = useState<PeerWithStats | null>(null);
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const [selectedArch, setSelectedArch] = useState<string>('amd64');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedDownload, setCopiedDownload] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await api.peers.list();
      setPeers(all.filter((p) => p.peerType === 'agent'));
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (peers.length === 0) return;
    for (const peer of peers) {
      if (!peer.enabled) continue;
      setAgentStatus((prev) => ({ ...prev, [peer.id]: 'checking' }));
      api.peers.agentHealth(peer.id)
        .then((res) => {
          setAgentStatus((prev) => ({ ...prev, [peer.id]: res.status === 'ok' ? 'online' : 'offline' }));
        })
        .catch(() => {
          setAgentStatus((prev) => ({ ...prev, [peer.id]: 'offline' }));
        });
    }
  }, [peers]);

  const handleCreate = async (data: any) => {
    await api.peers.create({ ...data, peerType: 'agent' });
    await refresh();
  };

  const handleEdit = async (data: any) => {
    if (!editingPeer) return;
    await api.peers.update(editingPeer.id, data);
    setEditingPeer(null);
    await refresh();
  };

  const handleDelete = async () => {
    if (!deletingPeer) return;
    await api.peers.delete(deletingPeer.id);
    setDeletingPeer(null);
    await refresh();
  };

  const handleToggle = async (peer: PeerWithStats, enabled: boolean) => {
    await api.peers.toggle(peer.id, enabled);
    await refresh();
  };

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const archOptions = [
    { value: 'amd64', label: 'x86_64 / amd64', desc: 'Most servers, Intel/AMD 64-bit' },
    { value: 'arm64', label: 'aarch64 / arm64', desc: 'Raspberry Pi 4/5, AWS Graviton' },
    { value: 'armv7', label: 'armv7l / armhf', desc: 'Raspberry Pi 2/3, 32-bit ARM' },
  ];

  const getDownloadUrl = (arch: string) =>
    `${window.location.origin}/agent-bin/yantra-agent-linux-${arch}`;

  const getInstallCommands = (arch: string) =>
    `curl -fsSL ${getDownloadUrl(arch)} -o /tmp/yantra-agent && sudo install -m 0755 /tmp/yantra-agent /usr/local/bin/yantra-agent && rm /tmp/yantra-agent`;

  const filtered = peers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.address.includes(search)
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">{peers.length} agents configured</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              {peers.length === 0 ? 'No agents yet' : 'No agents match your search'}
            </p>
            {peers.length === 0 && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((peer) => (
            <Card key={peer.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <div
                    className={`h-3 w-3 shrink-0 rounded-full ${
                      !peer.enabled
                        ? 'bg-gray-300 dark:bg-gray-600'
                        : peer.connected
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-yellow-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{peer.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                        {peer.networkType === 'local' ? <Wifi className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {peer.networkType === 'local' ? 'LAN' : 'WAN'}
                      </Badge>
                      {!peer.enabled && <Badge variant="secondary">Disabled</Badge>}
                      {peer.enabled && peer.connected && <Badge variant="success">Connected</Badge>}
                      {agentStatus[peer.id] === 'online' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-green-600 border-green-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Agent
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="font-mono">{peer.address}</span>
                      {peer.device && (
                        <span className="flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          {peer.device}
                        </span>
                      )}
                      {peer.email && <span>{peer.email}</span>}
                    </div>
                    {peer.enabled && peer.connected && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2 pt-2 border-t border-dashed">
                        {peer.endpoint !== '(none)' && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {peer.endpoint}
                          </span>
                        )}
                        {peer.latestHandshake > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(new Date(peer.latestHandshake * 1000))}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ArrowDown className="h-3 w-3" />
                          {formatBytes(peer.transferRx)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowUp className="h-3 w-3" />
                          {formatBytes(peer.transferTx)}
                        </span>
                      </div>
                    )}
                    {peer.enabled && !peer.connected && peer.latestHandshake > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2 pt-2 border-t border-dashed">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last seen {formatTimeAgo(new Date(peer.latestHandshake * 1000))}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowDown className="h-3 w-3" />
                          {formatBytes(peer.transferRx)}
                        </span>
                        <span className="flex items-center gap-1">
                          <ArrowUp className="h-3 w-3" />
                          {formatBytes(peer.transferTx)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={peer.enabled}
                      onCheckedChange={(checked) => handleToggle(peer, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSetupPeer(peer)}
                      title="Setup Agent"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPeer(peer)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingPeer(peer)}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPeer(expandedPeer === peer.id ? null : peer.id)}
                      className="text-xs"
                    >
                      {expandedPeer === peer.id ? 'Hide' : 'Details'}
                    </Button>
                  </div>
                </div>
                {expandedPeer === peer.id && (
                  <div className="border-t p-4">
                    <Tabs defaultValue="agent">
                      <TabsList className="mb-3 h-8">
                        <TabsTrigger value="agent" className="text-xs px-3">
                          Agent
                          {agentStatus[peer.id] === 'online' && (
                            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="text-xs px-3">Traffic</TabsTrigger>
                      </TabsList>
                      <TabsContent value="agent">
                        <AgentPanel peerId={peer.id} peerName={peer.name} accessKey={peer.accessKey} />
                      </TabsContent>
                      <TabsContent value="stats">
                        <TrafficChart
                          title={`Traffic — ${peer.name}`}
                          fetchData={(range) => api.stats.peer(peer.id, range)}
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PeerForm
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        mode="create"
        forcePeerType="agent"
      />

      {editingPeer && (
        <PeerForm
          open={true}
          onClose={() => setEditingPeer(null)}
          onSubmit={handleEdit}
          mode="edit"
          forcePeerType="agent"
          initialData={{
            name: editingPeer.name,
            email: editingPeer.email,
            device: editingPeer.device,
            dns: editingPeer.dns,
            allowedIps: editingPeer.allowedIps,
            persistentKeepalive: editingPeer.persistentKeepalive,
            networkType: editingPeer.networkType,
            peerType: editingPeer.peerType,
          }}
        />
      )}

      {/* Setup Agent Dialog */}
      <Dialog open={!!setupPeer} onOpenChange={(v) => { if (!v) { setSetupPeer(null); setCopiedKey(false); setCopiedCmd(false); setCopiedDownload(false); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setup Agent — {setupPeer?.name}</DialogTitle>
            <DialogDescription>
              Install yantra-agent on this machine to enable remote monitoring and commands.
            </DialogDescription>
          </DialogHeader>
          {setupPeer && (
            <div className="space-y-5">
              {/* Step 1: Architecture */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                  Select agent architecture
                </div>
                <Select value={selectedArch} onValueChange={setSelectedArch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {archOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Run <code className="rounded bg-muted px-1 py-0.5">uname -m</code> on the agent machine to check.
                </p>
              </div>

              {/* Step 2: Download & Install binary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                  Download &amp; install the agent binary
                </div>
                <div className="relative">
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto pr-10 whitespace-pre-wrap break-all">
                    {getInstallCommands(selectedArch)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopy(getInstallCommands(selectedArch), setCopiedDownload)}
                  >
                    {copiedDownload ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Step 3: Configure with ACCESS_KEY */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                  Configure the agent with ACCESS_KEY
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-md bg-muted p-3 text-xs font-mono flex-1 block truncate">
                    {'*'.repeat(26)}{setupPeer.accessKey.slice(-6)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleCopy(setupPeer.accessKey, setCopiedKey)}
                  >
                    {copiedKey ? <Check className="h-3 w-3 mr-1.5" /> : <Copy className="h-3 w-3 mr-1.5" />}
                    {copiedKey ? 'Copied' : 'Copy Key'}
                  </Button>
                </div>
                <div className="relative">
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto pr-10 whitespace-pre-wrap break-all">{`sudo mkdir -p /etc/yantra-agent && echo -e "AUTH_KEY=${setupPeer.accessKey}\\nPORT=9101" | sudo tee /etc/yantra-agent/config > /dev/null && sudo chmod 600 /etc/yantra-agent/config`}</pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopy(`sudo mkdir -p /etc/yantra-agent && echo -e "AUTH_KEY=${setupPeer.accessKey}\\nPORT=9101" | sudo tee /etc/yantra-agent/config > /dev/null && sudo chmod 600 /etc/yantra-agent/config`, setCopiedCmd)}
                  >
                    {copiedCmd ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Step 4: Create systemd service & start */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">4</span>
                  Create service &amp; start the agent
                </div>
                <div className="relative">
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`sudo tee /etc/systemd/system/yantra-agent.service > /dev/null <<'EOF'
[Unit]
Description=Yantraform Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/yantra-agent
Restart=always
RestartSec=5
EnvironmentFile=-/etc/yantra-agent/config

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable yantra-agent
sudo systemctl start yantra-agent`}</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verify with: <code className="rounded bg-muted px-1 py-0.5">sudo systemctl status yantra-agent</code>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPeer} onOpenChange={(v) => !v && setDeletingPeer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingPeer?.name}</strong>? This action
              cannot be undone. The peer will be removed from the VPN interface immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
