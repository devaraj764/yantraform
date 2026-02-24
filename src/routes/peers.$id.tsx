import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Server,
  Cpu,
  HardDrive,
  Monitor,
  Activity,
  Clock,
  Send,
} from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/ui/tabs';
import { TrafficChart } from '~/components/TrafficChart';
import { api, type PeerWithStats, type SystemInfo, type SshExecResult } from '~/lib/api';
import { formatBytes } from '~/lib/utils';

export const Route = createFileRoute('/peers/$id')({
  component: PeerDetailPage,
});

function UsageBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-lg font-semibold">{formatBytes(used)}</span>
          <span className="text-xs text-muted-foreground">/ {formatBytes(total)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% used</p>
      </CardContent>
    </Card>
  );
}

function PeerDetailPage() {
  const { id } = Route.useParams();
  const [peer, setPeer] = useState<PeerWithStats | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [sysLoading, setSysLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  // Terminal state
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<{ input: string; result: SshExecResult }[]>([]);
  const [cmdRunning, setCmdRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchPeer = useCallback(async () => {
    try {
      const all = await api.peers.list();
      const found = all.find((p) => p.id === id);
      setPeer(found ?? null);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSysInfo = useCallback(async () => {
    setSysLoading(true);
    try {
      const info = await api.peers.systemInfo(id);
      setSysInfo(info);
    } catch {
      setSysInfo(null);
    } finally {
      setSysLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPeer();
    fetchSysInfo();
    const interval = setInterval(fetchPeer, 15_000);
    return () => clearInterval(interval);
  }, [fetchPeer, fetchSysInfo]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cmdHistory]);

  const runCommand = async () => {
    const cmd = cmdInput.trim();
    if (!cmd) return;
    setCmdInput('');
    setCmdRunning(true);
    try {
      const result = await api.peers.sshExec(id, cmd);
      setCmdHistory((prev) => [...prev, { input: cmd, result }]);
    } catch (e: any) {
      setCmdHistory((prev) => [
        ...prev,
        { input: cmd, result: { stdout: '', stderr: e.message || 'Failed to execute', exitCode: 1 } },
      ]);
    } finally {
      setCmdRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!peer) {
    return (
      <div className="space-y-4">
        <Link to="/peers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Peers
        </Link>
        <p className="text-muted-foreground">Peer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/peers" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{peer.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{peer.address}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {sysLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : sysInfo ? (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={fetchSysInfo}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5" /> Hostname
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate">{sysInfo.hostname}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" /> OS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate">{sysInfo.os}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5" /> Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={sysInfo.osType === 'Linux Server' ? 'default' : 'secondary'}>
                      {sysInfo.osType}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Uptime
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate">{sysInfo.uptime}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> CPU Cores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{sysInfo.cpuCores}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Load Avg
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate">{sysInfo.loadAvg}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UsageBar used={sysInfo.memUsed} total={sysInfo.memTotal} label="Memory" />
                <UsageBar used={sysInfo.diskUsed} total={sysInfo.diskTotal} label="Disk (/)" />
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Unable to fetch system info. Make sure the peer is connected and SSH is configured.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={fetchSysInfo}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          <TrafficChart
            title={`Traffic - ${peer.name}`}
            fetchData={(range) => api.stats.peer(peer.id, range)}
          />
        </TabsContent>

        <TabsContent value="terminal" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="bg-zinc-950 text-zinc-100 rounded-lg overflow-hidden">
                <div className="h-[400px] overflow-y-auto p-4 font-mono text-sm space-y-2">
                  {cmdHistory.length === 0 && (
                    <p className="text-zinc-500">
                      Run commands on {peer.name} via SSH. Type a command below.
                    </p>
                  )}
                  {cmdHistory.map((entry, i) => (
                    <div key={i}>
                      <div className="text-green-400">
                        root@{sysInfo?.hostname ?? peer.address.split('/')[0]}:~$ {entry.input}
                      </div>
                      {entry.result.stdout && (
                        <pre className="whitespace-pre-wrap text-zinc-300">{entry.result.stdout}</pre>
                      )}
                      {entry.result.stderr && (
                        <pre className="whitespace-pre-wrap text-red-400">{entry.result.stderr}</pre>
                      )}
                      {entry.result.exitCode !== 0 && (
                        <div className="text-zinc-500 text-xs">exit code: {entry.result.exitCode}</div>
                      )}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
                <div className="border-t border-zinc-800 p-3 flex gap-2">
                  <Input
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !cmdRunning) runCommand();
                    }}
                    placeholder="Enter command..."
                    className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 font-mono"
                    disabled={cmdRunning}
                  />
                  <Button onClick={runCommand} disabled={cmdRunning || !cmdInput.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
