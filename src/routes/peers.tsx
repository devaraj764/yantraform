import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  QrCode,
  Download,
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
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';
import { Card, CardContent } from '~/components/ui/card';
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
import { PeerForm } from '~/components/PeerForm';
import { QRCodeModal } from '~/components/QRCodeModal';
import { SetupScriptModal } from '~/components/SetupScriptModal';
import { TrafficChart } from '~/components/TrafficChart';
import { api, type PeerWithStats } from '~/lib/api';
import { formatBytes, formatTimeAgo } from '~/lib/utils';

export const Route = createFileRoute('/peers')({
  component: ClientsPage,
});

const DEVICE_ICONS: Record<string, LucideIcon> = {
  'Windows PC': Monitor,
  'Mac': Laptop,
  'Linux PC': Monitor,
  'iPhone': Smartphone,
  'iPad': Tablet,
  'Android Phone': Smartphone,
  'Android Tablet': Tablet,
};

function getDeviceIcon(device: string): LucideIcon {
  return DEVICE_ICONS[device] || Monitor;
}

function ClientsPage() {
  const [peers, setPeers] = useState<PeerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingPeer, setEditingPeer] = useState<PeerWithStats | null>(null);
  const [deletingPeer, setDeletingPeer] = useState<PeerWithStats | null>(null);
  const [qrPeer, setQrPeer] = useState<PeerWithStats | null>(null);
  const [expandedPeer, setExpandedPeer] = useState<string | null>(null);
  const [scriptPeer, setScriptPeer] = useState<PeerWithStats | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await api.peers.list();
      setPeers(all);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCreate = async (data: any) => {
    await api.peers.create(data);
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

  const handleDownload = async (peer: PeerWithStats) => {
    const result = await api.peers.config(peer.id);
    const blob = new Blob([result.config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Peers</h1>
          <p className="text-muted-foreground">{peers.length} peers configured</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Peer
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
            <Monitor className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              {peers.length === 0 ? 'No peers yet' : 'No peers match your search'}
            </p>
            {peers.length === 0 && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first peer
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
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="font-mono">{peer.address}</span>
                      {peer.device && (() => {
                        const DeviceIcon = getDeviceIcon(peer.device);
                        return (
                          <span className="flex items-center gap-1">
                            <DeviceIcon className="h-3 w-3" />
                            {peer.device}
                          </span>
                        );
                      })()}
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
                    <Button variant="ghost" size="icon" onClick={() => setQrPeer(peer)} title="QR Code">
                      <QrCode className="h-4 w-4" />
                    </Button>
                    {peer.device.toLowerCase().includes('linux') && (
                      <Button variant="ghost" size="icon" onClick={() => setScriptPeer(peer)} title="Setup Script">
                        <Terminal className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(peer)} title="Download Config">
                      <Download className="h-4 w-4" />
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
                      {expandedPeer === peer.id ? 'Hide' : 'Stats'}
                    </Button>
                  </div>
                </div>
                {expandedPeer === peer.id && (
                  <div className="border-t p-4">
                    <TrafficChart
                      title={`Traffic — ${peer.name}`}
                      fetchData={(range) => api.stats.peer(peer.id, range)}
                    />
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
      />

      {editingPeer && (
        <PeerForm
          open={true}
          onClose={() => setEditingPeer(null)}
          onSubmit={handleEdit}
          mode="edit"
          initialData={{
            name: editingPeer.name,
            email: editingPeer.email,
            device: editingPeer.device,
            dns: editingPeer.dns,
            allowedIps: editingPeer.allowedIps,
            persistentKeepalive: editingPeer.persistentKeepalive,
            networkType: editingPeer.networkType,
          }}
        />
      )}

      {qrPeer && (
        <QRCodeModal open={true} onClose={() => setQrPeer(null)} peerId={qrPeer.id} peerName={qrPeer.name} />
      )}

      {scriptPeer && (
        <SetupScriptModal open={true} onClose={() => setScriptPeer(null)} peerId={scriptPeer.id} peerName={scriptPeer.name} />
      )}

      <AlertDialog open={!!deletingPeer} onOpenChange={(v) => !v && setDeletingPeer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Peer</AlertDialogTitle>
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
