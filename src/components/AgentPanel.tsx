import { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  Activity,
  Terminal,
  Download,
  Server,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { api, type AgentSysinfo } from '~/lib/api';

interface AgentPanelProps {
  peerId: string;
  peerName: string;
  accessKey: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatGB(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(1)} GB`;
}

export function AgentPanel({ peerId, peerName, accessKey }: AgentPanelProps) {
  const [sysinfo, setSysinfo] = useState<AgentSysinfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);

  // Command executor state
  const [command, setCommand] = useState('');
  const [execResult, setExecResult] = useState<{
    stdout: string;
    stderr: string;
    exit_code: number;
  } | null>(null);
  const [executing, setExecuting] = useState(false);

  // Install dialog
  const [showInstall, setShowInstall] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const health = await api.peers.agentHealth(peerId);
        if (cancelled) return;
        if (health.status === 'ok') {
          setAgentOnline(true);
          const info = await api.peers.agentSysinfo(peerId);
          if (!cancelled) setSysinfo(info);
        }
      } catch (e: any) {
        if (!cancelled) {
          setAgentOnline(false);
          setError(e?.message || 'Agent unreachable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [peerId]);

  const handleExec = async () => {
    if (!command.trim()) return;
    setExecuting(true);
    setExecResult(null);
    try {
      const result = await api.peers.agentExec(peerId, command);
      setExecResult(result);
    } catch (e: any) {
      setExecResult({
        stdout: '',
        stderr: e?.message || 'Failed to execute command',
        exit_code: -1,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyInstall = () => {
    const installUrl = `${window.location.origin}${api.peers.agentInstallScript(peerId)}`;
    navigator.clipboard.writeText(`curl -fsSL "${installUrl}" | sudo bash`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(accessKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-sm text-muted-foreground">Checking agent...</span>
      </div>
    );
  }

  if (!agentOnline) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>Agent not installed or unreachable</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowInstall(true)}>
          <Download className="h-4 w-4 mr-2" />
          Setup Agent
        </Button>

        <Dialog open={showInstall} onOpenChange={setShowInstall}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Agent on {peerName}</DialogTitle>
              <DialogDescription>
                Follow these steps to install yantra-agent on the agent machine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">1. Copy the ACCESS_KEY for this peer</div>
                <div className="flex items-center gap-2">
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono flex-1">
                    {'*'.repeat(26)}{accessKey.slice(-6)}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleCopyKey}
                  >
                    {copiedKey ? <Check className="h-3 w-3 mr-1.5" /> : <Copy className="h-3 w-3 mr-1.5" />}
                    {copiedKey ? 'Copied' : 'Copy Key'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">2. Run this on the agent machine</div>
                <div className="relative">
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto pr-10">
                    {`curl -fsSL "${window.location.origin}${api.peers.agentInstallScript(peerId)}" | sudo bash`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7"
                    onClick={handleCopyInstall}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">3. Paste the ACCESS_KEY when prompted</div>
                <p className="text-xs text-muted-foreground">
                  The installer will download the agent binary, ask for the ACCESS_KEY,
                  and set up a systemd service listening on port 9101.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const memUsedPct = sysinfo
    ? Math.round(((sysinfo.memory.total_mb - sysinfo.memory.available_mb) / sysinfo.memory.total_mb) * 100)
    : 0;
  const diskUsedPct = sysinfo && sysinfo.disk.total_gb > 0
    ? Math.round((sysinfo.disk.used_gb / sysinfo.disk.total_gb) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* System Info Grid */}
      {sysinfo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Server className="h-3 w-3" />
              Host
            </div>
            <div className="text-sm font-medium truncate">{sysinfo.hostname}</div>
            <div className="text-xs text-muted-foreground truncate">{sysinfo.os}</div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              CPU
            </div>
            <div className="text-sm font-medium">{sysinfo.cpu.cores} cores</div>
            <div className="text-xs text-muted-foreground truncate" title={sysinfo.cpu.model}>
              {sysinfo.cpu.model}
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MemoryStick className="h-3 w-3" />
              Memory
            </div>
            <div className="text-sm font-medium">
              {memUsedPct}% used
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(sysinfo.memory.total_mb - sysinfo.memory.available_mb)} / {Math.round(sysinfo.memory.total_mb)} MB
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${memUsedPct > 90 ? 'bg-red-500' : memUsedPct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${memUsedPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              Disk
            </div>
            <div className="text-sm font-medium">
              {diskUsedPct}% used
            </div>
            <div className="text-xs text-muted-foreground">
              {formatGB(sysinfo.disk.used_gb)} / {formatGB(sysinfo.disk.total_gb)}
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${diskUsedPct > 90 ? 'bg-red-500' : diskUsedPct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${diskUsedPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Uptime
            </div>
            <div className="text-sm font-medium">{formatUptime(sysinfo.uptime_seconds)}</div>
            <div className="text-xs text-muted-foreground">Kernel {sysinfo.kernel}</div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Load Average
            </div>
            <div className="text-sm font-medium">
              {sysinfo.load[0].toFixed(2)} / {sysinfo.load[1].toFixed(2)} / {sysinfo.load[2].toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">1m / 5m / 15m</div>
          </div>
        </div>
      )}

      {/* Command Executor */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3" />
          Remote Command
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExec()}
            className="font-mono text-sm"
          />
          <Button size="sm" onClick={handleExec} disabled={executing || !command.trim()}>
            {executing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Run'
            )}
          </Button>
        </div>
        {execResult && (
          <div className="rounded-md border">
            <div className="flex items-center gap-2 border-b px-3 py-1.5">
              <Badge variant={execResult.exit_code === 0 ? 'default' : 'destructive'} className="text-[10px]">
                exit: {execResult.exit_code}
              </Badge>
            </div>
            <pre className="max-h-64 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap">
              {execResult.stdout || execResult.stderr || '(no output)'}
            </pre>
            {execResult.stdout && execResult.stderr && (
              <pre className="border-t p-3 text-xs font-mono whitespace-pre-wrap text-red-500">
                {execResult.stderr}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
