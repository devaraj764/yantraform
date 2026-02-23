import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getSetting, setSetting, getAllPeers } from '~/server/db';
import { restartInterface, writeWireGuardConfig, generateKeyPair } from '~/server/wireguard';
import { generateServerConfig } from '~/server/config';
import { detectFirewall, addFirewallPort } from '~/server/firewall';

export const Route = createFileRoute('/api/server/restart')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        try {
          if (!(await getSetting('server_private_key'))) {
            const { privateKey, publicKey } = await generateKeyPair();
            await setSetting('server_private_key', privateKey);
            await setSetting('server_public_key', publicKey);
          }

          const iface = (await getSetting('server_interface')) || 'wg0';
          const peers = await getAllPeers();
          const configContent = await generateServerConfig(peers);
          await writeWireGuardConfig(iface, configContent);
          await restartInterface(iface);

          // Best-effort: ensure the WireGuard port is allowed through the firewall
          const port = parseInt((await getSetting('server_port')) || '51820', 10);
          try {
            const fw = await detectFirewall();
            if (fw.type !== 'none') {
              await addFirewallPort(fw.type, port, 'udp');
            }
          } catch {
            // Firewall rule failed, but WireGuard is up — don't block the response
          }

          return Response.json({ success: true });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
});
