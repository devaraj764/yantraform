import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import {
  getFirewallStatus,
  detectFirewall,
  addFirewallPort,
  removeFirewallPort,
  enableFirewall,
  disableFirewall,
} from '~/server/firewall';

export const Route = createFileRoute('/api/server/firewall')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const status = await getFirewallStatus();
        return Response.json(status);
      },

      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const { port, protocol } = body as { port: number; protocol: 'tcp' | 'udp' };

        if (!port || !protocol || !['tcp', 'udp'].includes(protocol)) {
          return Response.json(
            { success: false, message: 'Invalid port or protocol' },
            { status: 400 },
          );
        }

        const firewall = await detectFirewall();
        const result = await addFirewallPort(firewall.type, port, protocol);
        return Response.json(result, { status: result.success ? 200 : 400 });
      },

      PUT: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const firewall = await detectFirewall();
        const result = await enableFirewall(firewall.type);
        return Response.json(result, { status: result.success ? 200 : 400 });
      },

      PATCH: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const firewall = await detectFirewall();
        const result = await disableFirewall(firewall.type);
        return Response.json(result, { status: result.success ? 200 : 400 });
      },

      DELETE: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const { port, protocol } = body as { port: number; protocol: 'tcp' | 'udp' };

        if (!port || !protocol || !['tcp', 'udp'].includes(protocol)) {
          return Response.json(
            { success: false, message: 'Invalid port or protocol' },
            { status: 400 },
          );
        }

        const firewall = await detectFirewall();
        const result = await removeFirewallPort(firewall.type, port, protocol);
        return Response.json(result, { status: result.success ? 200 : 400 });
      },
    },
  },
});
