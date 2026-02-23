import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '~/server/auth';
import {
  getAllPeers,
  getNextAvailableIP,
  createPeer as dbCreatePeer,
  getSetting,
} from '~/server/db';
import {
  getInterfaceStatus,
  generateKeyPair,
  generatePresharedKey,
  addPeerToInterface,
} from '~/server/wireguard';
import { updateHostsFile } from '~/server/hosts';

export const Route = createFileRoute('/api/peers/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const peers = await getAllPeers();
        const iface = (await getSetting('server_interface')) || 'wg0';
        const status = await getInterfaceStatus(iface);

        const peerStatusMap = new Map<string, any>();
        if (status) {
          for (const p of status.peers) {
            peerStatusMap.set(p.publicKey, {
              endpoint: p.endpoint,
              latestHandshake: p.latestHandshake,
              transferRx: p.transferRx,
              transferTx: p.transferTx,
            });
          }
        }

        const result = peers.map((peer) => {
          const live = peerStatusMap.get(peer.public_key);
          const handshakeAge = live?.latestHandshake
            ? Date.now() / 1000 - live.latestHandshake
            : Infinity;

          return {
            id: peer.id,
            name: peer.name,
            email: peer.email,
            device: peer.device,
            publicKey: peer.public_key,
            hostname: peer.hostname || '',
            allowedIps: peer.allowed_ips,
            address: peer.address,
            dns: peer.dns,
            persistentKeepalive: peer.persistent_keepalive,
            enabled: peer.enabled === 1,
            networkType: peer.network_type,
            createdAt: peer.created_at,
            updatedAt: peer.updated_at,
            connected: handshakeAge < 180,
            latestHandshake: live?.latestHandshake || 0,
            transferRx: live?.transferRx || 0,
            transferTx: live?.transferTx || 0,
            endpoint: live?.endpoint || '(none)',
          };
        });

        return Response.json(result);
      },

      POST: async ({ request }) => {
        const authErr = await requireAuth(request);
        if (authErr) return authErr;

        const body = await request.json();
        const { privateKey, publicKey } = await generateKeyPair();
        const presharedKey = await generatePresharedKey();
        const address = await getNextAvailableIP();
        const dns = body.dns || (await getSetting('server_dns')) || '1.1.1.1';
        const id = crypto.randomUUID();

        await dbCreatePeer({
          id,
          name: body.name,
          email: body.email || '',
          private_key: privateKey,
          public_key: publicKey,
          preshared_key: presharedKey,
          access_key: '',
          allowed_ips: body.allowedIps || '0.0.0.0/0, ::/0',
          address,
          dns,
          persistent_keepalive: body.persistentKeepalive ?? 25,
          enabled: 1,
          device: body.device || '',
          network_type: body.networkType || 'remote',
          peer_type: 'peer',
          hostname: '',
        });

        try {
          const iface = (await getSetting('server_interface')) || 'wg0';
          await addPeerToInterface(iface, publicKey, presharedKey, address.split('/')[0] + '/32');
        } catch {}

        try {
          await updateHostsFile();
        } catch {}

        return Response.json({ id, address, publicKey });
      },
    },
  },
});
