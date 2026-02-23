import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getSetting } from '~/server/db';
import { stopInterface } from '~/server/wireguard';

export const Route = createFileRoute('/api/server/stop')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        try {
          const iface = (await getSetting('server_interface')) || 'wg0';
          await stopInterface(iface);
          return Response.json({ success: true });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
});
