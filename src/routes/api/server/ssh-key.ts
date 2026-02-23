import { createFileRoute } from '@tanstack/react-router';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { requireAuth } from '~/server/auth';
import { getSetting, setSetting } from '~/server/db';

function readSshPubKey(): string | null {
  const keyPath = join(homedir(), '.ssh/id_ed25519.pub');
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, 'utf-8').trim();
  }
  return null;
}

function generateSshKey(): string {
  const keyPath = join(homedir(), '.ssh/id_ed25519');
  execSync(`ssh-keygen -t ed25519 -f ${keyPath} -N "" -q`, { encoding: 'utf-8' });
  return readFileSync(keyPath + '.pub', 'utf-8').trim();
}

export const Route = createFileRoute('/api/server/ssh-key')({
  server: {
    handlers: {
      // Auto-detect or generate SSH key and save to DB
      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        try {
          let pubKey = readSshPubKey();
          let generated = false;

          if (!pubKey) {
            pubKey = generateSshKey();
            generated = true;
          }

          await setSetting('ssh_public_key', pubKey);

          return Response.json({ key: pubKey, generated });
        } catch (e: any) {
          return Response.json({ error: e.message || 'Failed to read/generate SSH key' }, { status: 500 });
        }
      },
    },
  },
});
