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
import { TriangleAlert } from 'lucide-react';

const OS_OPTIONS = [
  { id: 'ubuntu', label: 'Ubuntu' },
  { id: 'debian', label: 'Debian' },
  { id: 'fedora', label: 'Fedora' },
  { id: 'centos', label: 'CentOS' },
  { id: 'arch', label: 'Arch' },
  { id: 'alpine', label: 'Alpine' },
] as const;

type OsId = (typeof OS_OPTIONS)[number]['id'];

interface Step {
  title: string;
  description: string;
  command?: string;
  commands?: Record<string, string>;
}

interface SetupScriptModalProps {
  open: boolean;
  onClose: () => void;
  peerId: string;
  peerName: string;
}

function getCommandForOs(step: Step, os: OsId): string {
  if (step.commands && step.commands[os]) return step.commands[os];
  if (step.command) return step.command;
  return '';
}

export function SetupScriptModal({ open, onClose, peerId, peerName }: SetupScriptModalProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [hasSshKey, setHasSshKey] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOs, setSelectedOs] = useState<OsId>('ubuntu');

  useEffect(() => {
    if (!open || !peerId) return;
    setLoading(true);
    setError('');
    api.peers.setupScript(peerId)
      .then((result) => {
        setSteps(result.steps);
        setHasSshKey(result.hasSshKey);
      })
      .catch((e) => setError(e.message || 'Failed to generate script'))
      .finally(() => setLoading(false));
  }, [open, peerId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Setup Guide — {peerName}</DialogTitle>
          <DialogDescription>
            Select your OS and run each command on your remote machine.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 overflow-hidden min-h-0 flex-1">
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
                      SSH key step is skipped. Add your key in <strong>Settings</strong> to enable it.
                    </p>
                  </div>
                </div>
              )}

              {/* OS selector */}
              <div className="flex flex-wrap items-center gap-1.5">
                {OS_OPTIONS.map((os) => (
                  <button
                    key={os.id}
                    onClick={() => setSelectedOs(os.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedOs === os.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {os.label}
                  </button>
                ))}
              </div>

              {/* All steps in a scrollable list */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {steps.map((step, i) => {
                  const cmd = getCommandForOs(step, selectedOs);
                  return (
                    <div key={i} className="rounded-lg border bg-card p-4">
                      <h3 className="text-sm font-semibold">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold mr-2">
                          {i + 1}
                        </span>
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 ml-7">{step.description}</p>
                      <pre className="mt-3 ml-7 overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all select-all cursor-text">
                        {cmd}
                      </pre>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-1">
                <Button variant="outline" onClick={onClose}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
