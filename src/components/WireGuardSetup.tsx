import { AlertTriangle, ExternalLink, CheckCircle2, XCircle, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import type { WireGuardCheck } from '~/lib/api';

const INSTALL_URL = 'https://www.wireguard.com/install/';

const platforms = [
  { name: 'Ubuntu / Debian', cmd: 'sudo apt install wireguard wireguard-tools' },
  { name: 'Fedora', cmd: 'sudo dnf install wireguard-tools' },
  { name: 'Arch Linux', cmd: 'sudo pacman -S wireguard-tools' },
  { name: 'CentOS / RHEL', cmd: 'sudo yum install wireguard-tools' },
  { name: 'Alpine', cmd: 'sudo apk add wireguard-tools' },
];

const allInstalled = (c: WireGuardCheck) => c.wgInstalled && c.wgToolsInstalled;
const needsSudo = (c: WireGuardCheck) => allInstalled(c) && !c.sudoAccess;

export function WireGuardSetup({
  check,
  onRetry,
}: {
  check: WireGuardCheck;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <CardTitle className="text-xl">
            {needsSudo(check) ? 'Sudo Access Required' : 'WireGuard Not Found'}
          </CardTitle>
          <CardDescription>
            {needsSudo(check)
              ? 'WireGuard is installed but the app needs root privileges to manage the VPN interface.'
              : 'WireGuard must be installed on this system for the VPN manager to work.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status checks */}
          <div className="space-y-2 rounded-md border p-4">
            <StatusRow
              label="wg command"
              ok={check.wgInstalled}
              detail={check.wgVersion || 'Not found'}
            />
            <StatusRow
              label="wg-quick command"
              ok={check.wgToolsInstalled}
              detail={check.wgToolsInstalled ? 'Available' : 'Not found'}
            />
            <StatusRow
              label="Root / sudo access"
              ok={check.sudoAccess}
              detail={check.isRoot ? 'Running as root' : check.sudoAccess ? 'Passwordless sudo OK' : 'Not configured'}
            />
          </div>

          {/* Install instructions (only if wg not installed) */}
          {!allInstalled(check) && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Install WireGuard for your platform:</p>
              <div className="space-y-2">
                {platforms.map((p) => (
                  <div key={p.name} className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">{p.name}</p>
                    <code className="text-xs font-mono">{p.cmd}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sudo instructions (only if wg installed but no sudo) */}
          {needsSudo(check) && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Choose one of these options:</p>

              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Option 1: Run as root (simplest)</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <code className="text-xs font-mono">sudo vite dev</code>
                </div>
              </div>

              <div className="rounded-md border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Option 2: Passwordless sudo for WireGuard only (recommended)</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create a sudoers rule so the current user can run WireGuard commands without a password:
                </p>
                <div className="rounded-md bg-muted p-3 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">Run this command:</p>
                  <code className="text-xs font-mono block">
                    {`echo "${process.env.USER || '<username>'} ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/bin/wg-quick, /usr/bin/cp" | sudo tee /etc/sudoers.d/wireguard`}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Replace <code className="text-xs">&lt;username&gt;</code> with your actual username if it shows a placeholder above.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!allInstalled(check) && (
              <Button variant="outline" asChild>
                <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Official Installation Guide
                </a>
              </Button>
            )}
            <Button onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground font-mono">{detail}</span>
    </div>
  );
}
