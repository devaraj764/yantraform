import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getGlobalTrafficStats } from '~/server/db';

function getSinceDate(range: string): string {
  const now = new Date();
  switch (range) {
    case '1h': now.setHours(now.getHours() - 1); break;
    case '24h': now.setDate(now.getDate() - 1); break;
    case '7d': now.setDate(now.getDate() - 7); break;
    case '30d': now.setDate(now.getDate() - 30); break;
    default: now.setDate(now.getDate() - 1);
  }
  return now.toISOString().replace('T', ' ').split('.')[0];
}

export const Route = createFileRoute('/api/stats/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const url = new URL(request.url);
        const range = url.searchParams.get('range') || '24h';
        const since = getSinceDate(range);
        return Response.json(await getGlobalTrafficStats(since));
      },
    },
  },
});
