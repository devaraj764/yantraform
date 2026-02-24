import { exec } from 'child_process';
import { getAllPeers } from './db';

interface PingResult {
  alive: boolean;
  latencyMs: number | null;
  lastCheck: number;
}

const pingResults = new Map<string, PingResult>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function pingHost(ip: string): Promise<{ alive: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    exec(`ping -c 1 -W 2 ${ip}`, (error, stdout) => {
      if (error) {
        resolve({ alive: false, latencyMs: null });
        return;
      }
      const match = stdout.match(/time=([\d.]+)\s*ms/);
      resolve({
        alive: true,
        latencyMs: match ? parseFloat(match[1]) : null,
      });
    });
  });
}

export function startPingChecker(): void {
  if (intervalId) return;

  async function runChecks() {
    try {
      const peers = await getAllPeers();
      const now = Date.now();

      await Promise.all(
        peers
          .filter((p) => p.enabled === 1)
          .map(async (peer) => {
            const ip = peer.address.split('/')[0];
            const result = await pingHost(ip);
            pingResults.set(ip, {
              alive: result.alive,
              latencyMs: result.latencyMs,
              lastCheck: now,
            });
          })
      );
    } catch {
      // silently fail - peers may not be reachable
    }
  }

  // Run immediately on start
  runChecks();

  intervalId = setInterval(runChecks, 30_000);
}

export function getPingResults(): Map<string, PingResult> {
  return pingResults;
}
