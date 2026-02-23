import { createFileRoute } from '@tanstack/react-router';
import { requireAuth, initializePassword } from '~/server/auth';

export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await initializePassword();
        const authErr = await requireAuth(request);
        return Response.json({ authenticated: !authErr });
      },
    },
  },
});
