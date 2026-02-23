import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getAllSettings, setSetting } from '~/server/db';
import { updateHostsFile } from '~/server/hosts';

export const Route = createFileRoute('/api/server/config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;
        return Response.json(await getAllSettings());
      },

      PUT: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const allowedKeys = [
          'server_address', 'server_port', 'server_dns', 'server_endpoint',
          'server_interface', 'server_post_up', 'server_post_down', 'server_local_ip',
        ];

        for (const [key, value] of Object.entries(body)) {
          if (allowedKeys.includes(key) && typeof value === 'string') {
            await setSetting(key, value);
          }
        }

        try {
          await updateHostsFile();
        } catch {}

        return Response.json({ success: true });
      },
    },
  },
});
