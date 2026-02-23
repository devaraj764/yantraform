import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getSetting, setSetting } from '~/server/db';
import { generateKeyPair } from '~/server/wireguard';

export const Route = createFileRoute('/api/server/keys')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json().catch(() => ({}));
        const force = (body as any)?.force === true;

        const existing = await getSetting('server_private_key');
        if (existing && !force) {
          return Response.json({ publicKey: (await getSetting('server_public_key')) || '', alreadyExisted: true });
        }

        const { privateKey, publicKey } = await generateKeyPair();
        await setSetting('server_private_key', privateKey);
        await setSetting('server_public_key', publicKey);
        return Response.json({ publicKey, alreadyExisted: false });
      },
    },
  },
});
