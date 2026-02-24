import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import { getPeerById, getSetting, getAllSetupCommandsGrouped } from '~/server/db';
import { generatePeerConfig } from '~/server/config';

const STEP_META: Record<string, { title: string; description: string; sort: number }> = {
  install: { title: 'Install WireGuard', description: 'Install WireGuard on your machine.', sort: 1 },
  write_config: { title: 'Write WireGuard Config', description: 'Creates the WireGuard configuration file with your peer settings.', sort: 2 },
  enable: { title: 'Enable & Start WireGuard', description: 'Enable WireGuard to start on boot and activate the tunnel.', sort: 3 },
  ssh_key: { title: 'Add SSH Public Key', description: 'Adds the server SSH key to authorized_keys for passwordless access.', sort: 4 },
  verify: { title: 'Verify Connection', description: 'Check that the WireGuard tunnel is running.', sort: 5 },
};

export const Route = createFileRoute('/api/peers/$id/setup-script')({
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

        const sshPubKey = await getSetting('ssh_public_key');
        const grouped = await getAllSetupCommandsGrouped();

        // Determine step ordering from STEP_META
        const orderedTypes = Object.keys(STEP_META).sort(
          (a, b) => STEP_META[a].sort - STEP_META[b].sort
        );

        const steps: { title: string; description: string; command?: string; commands?: Record<string, string> }[] = [];

        for (const cmdType of orderedTypes) {
          // Skip ssh_key step if no key is configured
          if (cmdType === 'ssh_key' && !sshPubKey) continue;

          const cmdsForType = grouped[cmdType];
          if (!cmdsForType) continue;

          const meta = STEP_META[cmdType];

          // Replace placeholders with actual values
          const resolved: Record<string, string> = {};
          for (const [os, cmd] of Object.entries(cmdsForType)) {
            resolved[os] = cmd
              .replace(/\{\{CONFIG\}\}/g, config)
              .replace(/\{\{SSH_KEY\}\}/g, sshPubKey || '');
          }

          steps.push({
            title: meta.title,
            description: meta.description,
            commands: resolved,
          });
        }

        return Response.json({ steps, hasSshKey: !!sshPubKey });
      },
    },
  },
});
