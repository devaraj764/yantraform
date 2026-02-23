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
import { Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  peerId: string;
  peerName: string;
}

export function QRCodeModal({ open, onClose, peerId, peerName }: QRCodeModalProps) {
  const [dataUrl, setDataUrl] = useState('');
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !peerId) return;
    setLoading(true);
    api.peers.qrcode(peerId)
      .then((result) => {
        setDataUrl(result.dataUrl);
        setConfig(result.config);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, peerId]);

  const copyConfig = async () => {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code — {peerName}</DialogTitle>
          <DialogDescription>Scan this QR code with your WireGuard mobile app</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {loading ? (
            <div className="flex h-64 w-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <img src={dataUrl} alt="QR Code" className="h-64 w-64 rounded-lg border" />
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Config</span>
                  <Button variant="ghost" size="sm" onClick={copyConfig}>
                    {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                  {config}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
