import { createFileRoute } from '@tanstack/react-router';
import { checkWireGuardInstalled } from '~/server/wireguard';

export const Route = createFileRoute('/api/server/check')({
  server: {
    handlers: {
      GET: async () => {
        const result = checkWireGuardInstalled();
        return Response.json(result);
      },
    },
  },
});
