import { useState } from 'react';
import { Wifi, Globe } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

interface PeerFormData {
  name: string;
  email: string;
  device: string;
  dns: string;
  allowedIps: string;
  persistentKeepalive: number;
  networkType: 'local' | 'remote';
}

interface PeerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PeerFormData) => Promise<void>;
  initialData?: Partial<PeerFormData>;
  mode: 'create' | 'edit';
}

export function PeerForm({ open, onClose, onSubmit, initialData, mode }: PeerFormProps) {
  const [form, setForm] = useState<PeerFormData>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    device: initialData?.device || '',
    dns: initialData?.dns || '',
    allowedIps: initialData?.allowedIps || '0.0.0.0/0, ::/0',
    persistentKeepalive: initialData?.persistentKeepalive ?? 25,
    networkType: initialData?.networkType || 'remote',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'New Peer' : 'Edit Peer'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Create a new VPN peer. Keys and IP will be auto-generated.'
                : 'Update peer settings.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John's Laptop"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Network</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.networkType === 'local'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                  onClick={() => setForm((f) => ({ ...f, networkType: 'local' }))}
                >
                  <Wifi className="h-4 w-4" />
                  Local Network
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.networkType === 'remote'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                  onClick={() => setForm((f) => ({ ...f, networkType: 'remote' }))}
                >
                  <Globe className="h-4 w-4" />
                  Remote (Internet)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {form.networkType === 'local'
                  ? 'Peer connects via your local network (LAN IP)'
                  : 'Peer connects from the internet (public IP)'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="device">Device</Label>
              <Select value={form.device} onValueChange={(v) => setForm((f) => ({ ...f, device: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Windows PC">Windows PC</SelectItem>
                  <SelectItem value="Mac">Mac</SelectItem>
                  <SelectItem value="Linux PC">Linux PC</SelectItem>
                  <SelectItem value="Linux Server">Linux Server</SelectItem>
                  <SelectItem value="iPhone">iPhone</SelectItem>
                  <SelectItem value="iPad">iPad</SelectItem>
                  <SelectItem value="Android Phone">Android Phone</SelectItem>
                  <SelectItem value="Android Tablet">Android Tablet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns">DNS Servers</Label>
              <Input
                id="dns"
                value={form.dns}
                onChange={(e) => setForm((f) => ({ ...f, dns: e.target.value }))}
                placeholder="1.1.1.1, 1.0.0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowedIps">Allowed IPs</Label>
              <Input
                id="allowedIps"
                value={form.allowedIps}
                onChange={(e) => setForm((f) => ({ ...f, allowedIps: e.target.value }))}
                placeholder="0.0.0.0/0, ::/0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keepalive">Persistent Keepalive (seconds)</Label>
              <Input
                id="keepalive"
                type="number"
                value={form.persistentKeepalive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, persistentKeepalive: parseInt(e.target.value, 10) || 0 }))
                }
                min={0}
                max={600}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name}>
              {saving
                ? 'Saving...'
                : mode === 'create'
                  ? 'Create Peer'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
