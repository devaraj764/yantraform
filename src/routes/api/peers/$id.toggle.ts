import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById, updatePeer, getSetting } from '~/server/db';
import { addPeerToInterface, removePeerFromInterface } from '~/server/wireguard';

export const Route = createFileRoute('/api/peers/$id/toggle')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        const body = await request.json();
        const enabled = body.enabled;

        await updatePeer(params.id, { enabled: enabled ? 1 : 0 });

        const iface = (await getSetting('server_interface')) || 'wg0';
        try {
          if (enabled) {
            await addPeerToInterface(iface, peer.public_key, peer.preshared_key, peer.address.split('/')[0] + '/32');
          } else {
            await removePeerFromInterface(iface, peer.public_key);
          }
        } catch {}

        return Response.json({ success: true });
      },
    },
  },
});
