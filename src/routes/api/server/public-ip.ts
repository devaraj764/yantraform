import { createFileRoute } from '@tanstack/react-router';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { requireAuth } from '~/server/auth';

const exec = promisify(execCb);

async function getLocalIp(): Promise<string | null> {
  try {
    const { stdout } = await exec(
      "hostname -I | awk '{print $1}'",
      { timeout: 5000 },
    );
    const ip = stdout.trim();
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return ip;
    }
  } catch {}
  return null;
}

async function getPublicIp(): Promise<string | null> {
  const services = [
    'https://api.ipify.org',
    'https://ipv4.icanhazip.com',
    'https://v4.ident.me',
  ];

  for (const url of services) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const ip = (await res.text()).trim();
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
          return ip;
        }
      }
    } catch {
      // Try next service
    }
  }
  return null;
}

export const Route = createFileRoute('/api/server/public-ip')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const url = new URL(request.url);
        const type = url.searchParams.get('type');

        if (type === 'local') {
          const ip = await getLocalIp();
          if (ip) return Response.json({ ip });
          return Response.json(
            { ip: null, error: 'Could not detect local IP' },
            { status: 502 },
          );
        }

        const ip = await getPublicIp();
        if (ip) return Response.json({ ip });
        return Response.json(
          { ip: null, error: 'Could not detect public IP' },
          { status: 502 },
        );
      },
    },
  },
});
