import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById } from '~/server/db';
import { generatePeerConfig } from '~/server/config';

export const Route = createFileRoute('/api/peers/$id/config')({
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
        return Response.json({ config, filename: `${peer.name || 'peer'}.conf` });
      },
    },
  },
});
