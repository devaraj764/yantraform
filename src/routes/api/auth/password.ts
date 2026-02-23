import { createFileRoute } from '@tanstack/react-router';
import { verifyPassword, changePassword, requireAuth } from '~/server/auth';

export const Route = createFileRoute('/api/auth/password')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const valid = await verifyPassword(body.currentPassword);
        if (!valid) {
          return Response.json({ success: false, error: 'Current password is incorrect' });
        }
        await changePassword(body.newPassword);
        return Response.json({ success: true });
      },
    },
  },
});
