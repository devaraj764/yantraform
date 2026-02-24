import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById, getSetting } from '~/server/db';
import { sshExec } from '~/server/ssh';

export const Route = createFileRoute('/api/peers/$id/ssh-exec')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        if (!peer.enabled) {
          return Response.json({ error: 'Peer is disabled' }, { status: 400 });
        }

        if (!peer.device.toLowerCase().includes('linux')) {
          return Response.json({ error: 'SSH is only supported for Linux peers' }, { status: 400 });
        }

        const sshPubKey = await getSetting('ssh_public_key');
        if (!sshPubKey) {
          return Response.json({ error: 'SSH public key not configured on server' }, { status: 400 });
        }

        const body = await request.json();
        const command = body.command;
        if (!command || typeof command !== 'string') {
          return Response.json({ error: 'command is required' }, { status: 400 });
        }

        const peerIp = peer.address.split('/')[0];
        const result = await sshExec(peerIp, command);

        return Response.json(result);
      },
    },
  },
});
