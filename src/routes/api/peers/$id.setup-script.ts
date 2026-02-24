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

        const steps: { title: string; description: string; command?: string; commands?: Record<string, string> }[] = [
          {
            title: 'Install WireGuard',
            description: 'Install WireGuard on your machine.',
            commands: {
              ubuntu: 'sudo apt-get update && sudo apt-get install -y wireguard',
              debian: 'sudo apt-get update && sudo apt-get install -y wireguard',
              fedora: 'sudo dnf install -y wireguard-tools',
              centos: 'sudo yum install -y epel-release && sudo yum install -y wireguard-tools',
              arch: 'sudo pacman -Sy --noconfirm wireguard-tools',
              alpine: 'sudo apk add wireguard-tools',
              macos: 'brew install wireguard-tools',
              windows: 'Download the installer from https://www.wireguard.com/install/ and run it.',
            },
          },
          {
            title: 'Write WireGuard Config',
            description: 'Creates the WireGuard configuration file with your peer settings.',
            commands: {
              ubuntu: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              debian: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              fedora: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              centos: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              arch: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              alpine: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              macos: `sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n${config}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf`,
              windows: `Save the following as a .conf file and import it into the WireGuard app:\n\n${config}`,
            },
          },
          {
            title: 'Enable & Start WireGuard',
            description: 'Enable WireGuard to start on boot and activate the tunnel.',
            commands: {
              ubuntu: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
              debian: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
              fedora: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
              centos: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
              arch: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
              alpine: 'sudo rc-update add wg-quick.wg0 default && sudo rc-service wg-quick.wg0 start',
              macos: 'brew services start wireguard-tools\n# Or use: sudo wg-quick up wg0',
              windows: 'Open the WireGuard app, import the config file, and click "Activate".',
            },
          },
        ];

        if (sshPubKey) {
          steps.push({
            title: 'Add SSH Public Key',
            description: 'Adds the server SSH key to authorized_keys for passwordless access.',
            commands: {
              ubuntu: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              debian: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              fedora: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              centos: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              arch: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              alpine: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              macos: `mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '${sshPubKey}' ~/.ssh/authorized_keys 2>/dev/null || echo '${sshPubKey}' >> ~/.ssh/authorized_keys)`,
              windows: `Add this key to your authorized_keys file:\n${sshPubKey}`,
            },
          });
        }

        steps.push({
          title: 'Verify Connection',
          description: 'Check that the WireGuard tunnel is running.',
          commands: {
            ubuntu: 'sudo wg show wg0',
            debian: 'sudo wg show wg0',
            fedora: 'sudo wg show wg0',
            centos: 'sudo wg show wg0',
            arch: 'sudo wg show wg0',
            alpine: 'sudo wg show wg0',
            macos: 'sudo wg show wg0',
            windows: 'Open the WireGuard app and check the tunnel status shows as "Active".',
          },
        });

        return Response.json({ steps, hasSshKey: !!sshPubKey });
      },
    },
  },
});
