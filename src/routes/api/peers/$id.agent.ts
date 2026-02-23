import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById } from '~/server/db';

const AGENT_PORT = 9101;
const AGENT_TIMEOUT = 10_000; // 10s timeout for proxy requests

export const Route = createFileRoute('/api/peers/$id/agent')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        if (!peer.access_key) {
          return Response.json({ error: 'Peer has no access key' }, { status: 400 });
        }

        const url = new URL(request.url);
        const path = url.searchParams.get('path') || 'health';

        if (!['health', 'sysinfo'].includes(path)) {
          return Response.json({ error: 'Invalid path. Use: health, sysinfo' }, { status: 400 });
        }

        const peerIp = peer.address.split('/')[0];

        try {
          const resp = await fetch(`http://${peerIp}:${AGENT_PORT}/${path}`, {
            headers: { 'X-Auth-Key': peer.access_key },
            signal: AbortSignal.timeout(AGENT_TIMEOUT),
          });
          const data = await resp.json();
          return Response.json(data, { status: resp.status });
        } catch (e: any) {
          return Response.json(
            { error: 'Agent unreachable', details: e?.message || 'Connection failed' },
            { status: 502 }
          );
        }
      },

      POST: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        if (!peer.access_key) {
          return Response.json({ error: 'Peer has no access key' }, { status: 400 });
        }

        const body = await request.json();
        if (!body.command || typeof body.command !== 'string') {
          return Response.json({ error: 'Missing "command" field' }, { status: 400 });
        }

        const peerIp = peer.address.split('/')[0];

        try {
          const resp = await fetch(`http://${peerIp}:${AGENT_PORT}/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Key': peer.access_key,
            },
            body: JSON.stringify({ command: body.command }),
            signal: AbortSignal.timeout(35_000), // 35s to allow for 30s exec timeout
          });
          const data = await resp.json();
          return Response.json(data, { status: resp.status });
        } catch (e: any) {
          return Response.json(
            { error: 'Agent unreachable', details: e?.message || 'Connection failed' },
            { status: 502 }
          );
        }
      },
    },
  },
});
