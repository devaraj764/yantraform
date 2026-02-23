import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import {
  getPeerById,
  updatePeer as dbUpdatePeer,
  deletePeer as dbDeletePeer,
} from '~/server/db';
import { getSetting } from '~/server/db';
import { removePeerFromInterface } from '~/server/wireguard';
import { updateHostsFile } from '~/server/hosts';

export const Route = createFileRoute('/api/peers/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });
        return Response.json(peer);
      },

      PUT: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        const body = await request.json();
        const mapped: Record<string, string | number> = {};
        if (body.name !== undefined) mapped.name = body.name;
        if (body.email !== undefined) mapped.email = body.email;
        if (body.dns !== undefined) mapped.dns = body.dns;
        if (body.allowedIps !== undefined) mapped.allowed_ips = body.allowedIps;
        if (body.persistentKeepalive !== undefined) mapped.persistent_keepalive = body.persistentKeepalive;
        if (body.peerType !== undefined) mapped.peer_type = body.peerType;

        await dbUpdatePeer(params.id, mapped as any);

        return Response.json({ success: true });
      },

      DELETE: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        try {
          const iface = (await getSetting('server_interface')) || 'wg0';
          await removePeerFromInterface(iface, peer.public_key);
        } catch {}

        await dbDeletePeer(params.id);

        try {
          await updateHostsFile();
        } catch {}

        return Response.json({ success: true });
      },
    },
  },
});
