import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { api } from '~/lib/api';
import { Copy, Check, TriangleAlert } from 'lucide-react';

interface SetupScriptModalProps {
  open: boolean;
  onClose: () => void;
  peerId: string;
  peerName: string;
}

export function SetupScriptModal({ open, onClose, peerId, peerName }: SetupScriptModalProps) {
  const [script, setScript] = useState('');
  const [hasSshKey, setHasSshKey] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !peerId) return;
    setLoading(true);
    setError('');
    api.peers.setupScript(peerId)
      .then((result) => {
        setScript(result.script);
        setHasSshKey(result.hasSshKey);
      })
      .catch((e) => setError(e.message || 'Failed to generate script'))
      .finally(() => setLoading(false));
  }, [open, peerId]);

  const copyScript = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Setup Script — {peerName}</DialogTitle>
          <DialogDescription>
            SSH into your remote machine and paste this script to install WireGuard and connect to the VPN.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2 overflow-hidden min-h-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          ) : (
            <>
              {!hasSshKey && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
                  <TriangleAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium">No SSH public key configured</p>
                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                      The script won't set up SSH access from the master server.
                      Add your SSH public key in <strong>Settings</strong> to enable this.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Copy and run via SSH on the target machine
                </span>
                <Button variant="outline" size="sm" onClick={copyScript}>
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copied!' : 'Copy Script'}
                </Button>
              </div>
              <pre className="flex-1 min-h-0 overflow-auto rounded-md bg-muted p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
{script}
              </pre>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
