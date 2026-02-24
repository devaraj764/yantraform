import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById, getSetting } from '~/server/db';
import { sshExec } from '~/server/ssh';

export const Route = createFileRoute('/api/peers/$id/system-info')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peer = await getPeerById(params.id);
        if (!peer) return Response.json({ error: 'Not found' }, { status: 404 });

        if (!peer.enabled) {
          return Response.json({ error: 'Peer is disabled' }, { status: 400 });
        }

        if (!peer.device.toLowerCase().includes('linux')) {
          return Response.json({ error: 'SSH is only supported for Linux peers' }, { status: 400 });
        }

        const sshPubKey = await getSetting('ssh_public_key');
        if (!sshPubKey) {
          return Response.json({ error: 'SSH public key not configured on server' }, { status: 400 });
        }

        const peerIp = peer.address.split('/')[0];

        const [hostname, osRelease, procUptime, nproc, meminfo, df, loadavg, defaultTarget] = await Promise.all([
          sshExec(peerIp, 'hostname'),
          sshExec(peerIp, 'cat /etc/os-release'),
          sshExec(peerIp, 'cat /proc/uptime'),
          sshExec(peerIp, 'nproc'),
          sshExec(peerIp, 'cat /proc/meminfo'),
          sshExec(peerIp, 'df -k /'),
          sshExec(peerIp, 'cat /proc/loadavg'),
          sshExec(peerIp, 'systemctl get-default 2>/dev/null || echo unknown'),
        ]);

        // Parse OS from /etc/os-release
        let os = 'Unknown';
        const prettyMatch = osRelease.stdout.match(/PRETTY_NAME="(.+?)"/);
        if (prettyMatch) os = prettyMatch[1];

        // Detect OS type: graphical.target = PC, otherwise = Server
        const target = defaultTarget.stdout.trim();
        const osType = target.includes('graphical') ? 'Linux PC' : 'Linux Server';

        // Parse uptime from /proc/uptime (first field = seconds since boot)
        let uptime = 'Unknown';
        const uptimeSecs = parseFloat(procUptime.stdout.trim().split(/\s+/)[0]);
        if (!isNaN(uptimeSecs)) {
          const days = Math.floor(uptimeSecs / 86400);
          const hours = Math.floor((uptimeSecs % 86400) / 3600);
          const mins = Math.floor((uptimeSecs % 3600) / 60);
          const parts = [];
          if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
          if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
          if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
          uptime = parts.join(', ') || '< 1 minute';
        }

        // Parse memory from /proc/meminfo (values in kB)
        let memTotal = 0;
        let memUsed = 0;
        let memAvailable = 0;
        const memTotalMatch = meminfo.stdout.match(/MemTotal:\s+(\d+)/);
        const memAvailMatch = meminfo.stdout.match(/MemAvailable:\s+(\d+)/);
        if (memTotalMatch) memTotal = parseInt(memTotalMatch[1], 10) * 1024;
        if (memAvailMatch) memAvailable = parseInt(memAvailMatch[1], 10) * 1024;
        memUsed = memTotal - memAvailable;

        // Parse disk from df -k / (output in 1K blocks)
        let diskTotal = 0;
        let diskUsed = 0;
        const dfLines = df.stdout.split('\n');
        if (dfLines.length >= 2) {
          const dfParts = dfLines[1].split(/\s+/);
          diskTotal = (parseInt(dfParts[1], 10) || 0) * 1024;
          diskUsed = (parseInt(dfParts[2], 10) || 0) * 1024;
        }

        // Parse load average
        const loadParts = loadavg.stdout.trim().split(/\s+/);
        const loadAvg = loadParts.slice(0, 3).join(' ');

        return Response.json({
          hostname: hostname.stdout.trim(),
          os,
          osType,
          uptime,
          cpuCores: parseInt(nproc.stdout.trim(), 10) || 0,
          memTotal,
          memUsed,
          diskTotal,
          diskUsed,
          loadAvg,
        });
      },
    },
  },
});
