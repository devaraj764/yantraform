import { createFileRoute } from '@tanstack/react-router';
import { verifyPassword, signToken, initializePassword } from '~/server/auth';

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initializePassword();
        const body = await request.json();
        const valid = await verifyPassword(body.password);
        if (!valid) {
          return Response.json({ success: false, error: 'Invalid password' }, { status: 401 });
        }
        const token = await signToken();
        return Response.json({ success: true, token });
      },
    },
  },
});
