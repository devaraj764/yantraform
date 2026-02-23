import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getAllPeers, getSetting } from '~/server/db';
import {
  getDnsmasqStatus,
  setupDnsmasq,
  startDnsmasq,
  stopDnsmasq,
  restartDnsmasq,
  getDnsRecords,
  addDnsRecord,
  deleteDnsRecord,
} from '~/server/dns';

export const Route = createFileRoute('/api/server/dns')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const dnsmasq = await getDnsmasqStatus();
        const records = getDnsRecords();

        // Build available targets from server + all peers
        const availableTargets: { ip: string; name: string }[] = [];

        const serverAddr = (await getSetting('server_address')) || '10.8.0.1/24';
        const serverIp = serverAddr.split('/')[0];
        availableTargets.push({ ip: serverIp, name: 'Server' });

        const peers = await getAllPeers();
        for (const peer of peers) {
          const ip = peer.address.split('/')[0];
          availableTargets.push({ ip, name: peer.name });
        }

        return Response.json({ dnsmasq, records, availableTargets });
      },

      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const { action } = body as { action: string };

        if (!action || !['setup', 'start', 'stop', 'restart', 'add-record', 'delete-record'].includes(action)) {
          return Response.json(
            { success: false, message: 'Invalid action' },
            { status: 400 },
          );
        }

        let result;
        switch (action) {
          case 'setup': {
            const iface = (await getSetting('server_interface')) || 'wg0';
            result = await setupDnsmasq(iface);
            break;
          }
          case 'start':
            result = await startDnsmasq();
            break;
          case 'stop':
            result = await stopDnsmasq();
            break;
          case 'restart':
            result = await restartDnsmasq();
            break;
          case 'add-record': {
            const { hostname, ip } = body as { hostname: string; ip: string };
            if (!hostname || !ip) {
              return Response.json(
                { success: false, message: 'hostname and ip are required' },
                { status: 400 },
              );
            }
            result = await addDnsRecord(hostname, ip);
            break;
          }
          case 'delete-record': {
            const { hostname: delHost, ip: delIp } = body as { hostname: string; ip: string };
            if (!delHost || !delIp) {
              return Response.json(
                { success: false, message: 'hostname and ip are required' },
                { status: 400 },
              );
            }
            result = await deleteDnsRecord(delHost, delIp);
            break;
          }
        }

        return Response.json(result, { status: result!.success ? 200 : 400 });
      },
    },
  },
});
