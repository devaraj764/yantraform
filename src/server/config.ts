import { getSetting, type PeerRow } from './db';

export async function generateServerConfig(
  peers: PeerRow[]
): Promise<string> {
  const privateKey = (await getSetting('server_private_key')) || '';
  const address = (await getSetting('server_address')) || '10.8.0.1/24';
  const port = (await getSetting('server_port')) || '51820';
  const postUp = (await getSetting('server_post_up')) || '';
  const postDown = (await getSetting('server_post_down')) || '';

  let config = `[Interface]
PrivateKey = ${privateKey}
Address = ${address}
ListenPort = ${port}`;

  if (postUp) config += `\nPostUp = ${postUp}`;
  if (postDown) config += `\nPostDown = ${postDown}`;

  for (const peer of peers) {
    if (!peer.enabled) continue;
    config += `\n\n[Peer]
PublicKey = ${peer.public_key}`;
    if (peer.preshared_key) config += `\nPresharedKey = ${peer.preshared_key}`;
    config += `\nAllowedIPs = ${peer.address.split('/')[0]}/32`;
  }

  return config;
}

export async function generatePeerConfig(peer: PeerRow): Promise<string> {
  const serverPublicKey = (await getSetting('server_public_key')) || '';
  if (!serverPublicKey) {
    throw new Error('Server public key is not configured. Generate server keys in Settings first.');
  }
  const serverEndpoint = (await getSetting('server_endpoint')) || '';
  const serverLocalIp = (await getSetting('server_local_ip')) || '';
  const serverPort = (await getSetting('server_port')) || '51820';
  const dns = peer.dns || (await getSetting('server_dns')) || '1.1.1.1';

  let config = `[Interface]
PrivateKey = ${peer.private_key}
Address = ${peer.address}
DNS = ${dns}`;

  config += `\n\n[Peer]
PublicKey = ${serverPublicKey}`;
  if (peer.preshared_key) config += `\nPresharedKey = ${peer.preshared_key}`;
  config += `\nAllowedIPs = ${peer.allowed_ips}`;

  // Use local IP for local peers, public IP for remote peers
  let endpoint: string;
  if (peer.network_type === 'local') {
    endpoint = serverLocalIp || 'YOUR_LOCAL_IP';
  } else {
    endpoint = serverEndpoint || 'YOUR_SERVER_IP';
  }
  config += `\nEndpoint = ${endpoint}:${serverPort}`;

  if (peer.persistent_keepalive > 0) {
    config += `\nPersistentKeepalive = ${peer.persistent_keepalive}`;
  }

  return config;
}

export async function generateHostsEntries(peers: PeerRow[]): Promise<string> {
  const lines: string[] = [];

  // Server (master) hostname
  const serverHostname = await getSetting('server_hostname');
  if (serverHostname) {
    const serverAddr = (await getSetting('server_address')) || '10.8.0.1/24';
    const serverIp = serverAddr.split('/')[0];
    lines.push(`${serverIp}\t${serverHostname}\t# managed by yantraform`);
  }

  // Peer hostnames
  for (const peer of peers) {
    if (!peer.hostname) continue;
    const ip = peer.address.split('/')[0];
    lines.push(`${ip}\t${peer.hostname}\t# managed by yantraform`);
  }
  return lines.join('\n');
}
