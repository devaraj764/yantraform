import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById } from '~/server/db';
import { generatePeerConfig } from '~/server/config';
import { generateQRCodeDataURL } from '~/server/qrcode';

export const Route = createFileRoute('/api/peers/$id/qrcode')({
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
        const dataUrl = await generateQRCodeDataURL(config);
        return Response.json({ dataUrl, config });
      },
    },
  },
});
