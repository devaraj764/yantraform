import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById, getSetting } from '~/server/db';
import { generatePeerConfig } from '~/server/config';

export const Route = createFileRoute('/api/peers/$id/setup-script')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        let config: string;
        try {
          config = await generatePeerConfig(peer);
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 400 });
        }

        const sshPubKey = await getSetting('ssh_public_key');

        let sshBlock = '';
        if (sshPubKey) {
          sshBlock = `
echo ">>> Adding master server SSH public key..."

mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Only add if not already present
if ! grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null; then
  echo '${sshPubKey}' >> ~/.ssh/authorized_keys
  echo "    Key added to ~/.ssh/authorized_keys"
else
  echo "    Key already present, skipping"
fi
`;
        }

        const script = `#!/bin/bash
set -e

# ─────────────────────────────────────────────────────
# WireGuard + SSH Setup Script for: ${peer.name}
# VPN Address: ${peer.address}
# ─────────────────────────────────────────────────────

echo ">>> Installing WireGuard..."

if command -v apt-get &>/dev/null; then
  sudo apt-get update -qq && sudo apt-get install -y -qq wireguard
elif command -v dnf &>/dev/null; then
  sudo dnf install -y wireguard-tools
elif command -v yum &>/dev/null; then
  sudo yum install -y epel-release
  sudo yum install -y wireguard-tools
elif command -v pacman &>/dev/null; then
  sudo pacman -Sy --noconfirm wireguard-tools
elif command -v apk &>/dev/null; then
  sudo apk add wireguard-tools
else
  echo "ERROR: Unsupported package manager. Install WireGuard manually."
  exit 1
fi

echo ">>> Writing WireGuard config to /etc/wireguard/wg0.conf..."

sudo mkdir -p /etc/wireguard
sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'
${config}
WGCONF

sudo chmod 600 /etc/wireguard/wg0.conf

echo ">>> Enabling and starting WireGuard..."

sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
${sshBlock}
echo ""
echo ">>> Done! WireGuard is now running."
echo ">>> Interface status:"
sudo wg show wg0
`;

        return Response.json({ script, hasSshKey: !!sshPubKey });
      },
    },
  },
});
