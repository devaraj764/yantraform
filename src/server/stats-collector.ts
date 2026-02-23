import { getSetting, recordTrafficStats, cleanupOldStats } from './db';
import { getInterfaceStatus } from './wireguard';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startStatsCollector(): void {
  if (intervalId) return;

  // Collect every 30 seconds
  intervalId = setInterval(async () => {
    try {
      const iface = (await getSetting('server_interface')) || 'wg0';
      const status = await getInterfaceStatus(iface);
      if (!status) return;

      for (const peer of status.peers) {
        await recordTrafficStats(peer.publicKey, peer.transferRx, peer.transferTx);
      }
    } catch {
      // silently fail - interface may be down
    }
  }, 30_000);

  // Cleanup old stats once per hour
  setInterval(async () => {
    try {
      await cleanupOldStats();
    } catch {
      // ignore
    }
  }, 3600_000);
}

export function stopStatsCollector(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
