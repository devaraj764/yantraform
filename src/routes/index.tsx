import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Wifi,
  WifiOff,
  ArrowDownToLine,
  ArrowUpFromLine,
  Server,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { TrafficChart } from '~/components/TrafficChart';
import { api, type PeerWithStats, type ServerStatus } from '~/lib/api';
import { formatBytes } from '~/lib/utils';

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Dashboard() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [peers, setPeers] = useState<PeerWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [status, peerList] = await Promise.all([
        api.server.status(),
        api.peers.list(),
      ]);
      setServerStatus(status);
      setPeers(peerList);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const totalRx = peers.reduce((acc, p) => acc + p.transferRx, 0);
  const totalTx = peers.reduce((acc, p) => acc + p.transferTx, 0);
  const connectedCount = peers.filter((p) => p.connected).length;

  const loadGlobalStats = useCallback(
    (range: string) => api.stats.global(range),
    []
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Yantraform server overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Server Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {serverStatus?.running ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">Running</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold">Stopped</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Port {serverStatus?.listenPort || '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Peers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Badge variant="success" className="mr-1">{connectedCount}</Badge>
              connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalRx)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all peers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalTx)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all peers</p>
          </CardContent>
        </Card>
      </div>

      {serverStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Server Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Interface</span>
                <p className="font-medium">{serverStatus.interface}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Address</span>
                <p className="font-medium">{serverStatus.address}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Endpoint</span>
                <p className="font-medium font-mono text-xs">{serverStatus.endpoint || 'Not set'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Public Key</span>
                <p className="font-medium font-mono text-xs truncate" title={serverStatus.publicKey}>
                  {serverStatus.publicKey || 'Not generated'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <TrafficChart title="Global Traffic" fetchData={loadGlobalStats} />

      {peers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peer Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {peers.slice(0, 10).map((peer) => (
                <div key={peer.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${peer.connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div>
                      <p className="text-sm font-medium">{peer.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{peer.address}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatBytes(peer.transferRx)} / {formatBytes(peer.transferTx)}</p>
                    <p>{peer.connected ? 'Connected' : 'Disconnected'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
