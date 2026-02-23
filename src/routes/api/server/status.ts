import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getSetting, getAllPeers } from '~/server/db';
import { isInterfaceUp, getInterfaceStatus } from '~/server/wireguard';

export const Route = createFileRoute('/api/server/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const iface = (await getSetting('server_interface')) || 'wg0';
        const up = await isInterfaceUp(iface);
        const status = up ? await getInterfaceStatus(iface) : null;

        return Response.json({
          running: up,
          interface: iface,
          publicKey: (await getSetting('server_public_key')) || '',
          listenPort: parseInt((await getSetting('server_port')) || '51820', 10),
          address: (await getSetting('server_address')) || '10.8.0.1/24',
          endpoint: (await getSetting('server_endpoint')) || '',
          connectedPeers: status?.peers.filter((p) => Date.now() / 1000 - p.latestHandshake < 180).length || 0,
          totalPeers: (await getAllPeers()).length,
        });
      },
    },
  },
});
