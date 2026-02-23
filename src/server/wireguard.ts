import { execSync, exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync } from 'node:fs';

const exec = promisify(execCb);

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function runAsync(cmd: string): Promise<string> {
  const { stdout } = await exec(cmd);
  return stdout.trim();
}

export interface WireGuardCheck {
  wgInstalled: boolean;
  wgToolsInstalled: boolean;
  wgVersion: string | null;
  sudoAccess: boolean;
  isRoot: boolean;
}

export function checkWireGuardInstalled(): WireGuardCheck {
  let wgInstalled = false;
  let wgToolsInstalled = false;
  let wgVersion: string | null = null;
  let sudoAccess = false;
  const isRoot = process.getuid?.() === 0;

  try {
    wgVersion = execSync('wg --version 2>&1', { encoding: 'utf-8' }).trim();
    wgInstalled = true;
  } catch {}

  try {
    execSync('which wg-quick', { encoding: 'utf-8' });
    wgToolsInstalled = true;
  } catch {}

  if (isRoot) {
    sudoAccess = true;
  } else {
    try {
      // Check if sudo wg works without a password prompt
      execSync('sudo -n wg show 2>&1', { encoding: 'utf-8', timeout: 5000 });
      sudoAccess = true;
    } catch (e: any) {
      // If wg is installed but the command failed because no interface is up,
      // sudo still worked — check the error message
      const msg = e.stderr?.toString() || e.stdout?.toString() || '';
      if (!msg.includes('password is required') && !msg.includes('sudo:')) {
        sudoAccess = true;
      }
    }
  }

  return { wgInstalled, wgToolsInstalled, wgVersion, sudoAccess, isRoot };
}

export interface WgPeerStatus {
  publicKey: string;
  presharedKey: string;
  endpoint: string;
  allowedIps: string;
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
  persistentKeepalive: string;
}

export interface WgInterfaceStatus {
  publicKey: string;
  listenPort: number;
  peers: WgPeerStatus[];
}

export async function getInterfaceStatus(iface: string): Promise<WgInterfaceStatus | null> {
  try {
    const output = await runAsync(`sudo wg show ${iface} dump`);
    const lines = output.split('\n');
    if (lines.length === 0) return null;

    const [, pubKey, listenPort] = lines[0].split('\t');
    const peers: WgPeerStatus[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length < 8) continue;
      peers.push({
        publicKey: parts[0],
        presharedKey: parts[1],
        endpoint: parts[2],
        allowedIps: parts[3],
        latestHandshake: parseInt(parts[4], 10),
        transferRx: parseInt(parts[5], 10),
        transferTx: parseInt(parts[6], 10),
        persistentKeepalive: parts[7],
      });
    }

    return { publicKey: pubKey, listenPort: parseInt(listenPort, 10), peers };
  } catch {
    return null;
  }
}

export async function isInterfaceUp(iface: string): Promise<boolean> {
  try {
    await runAsync(`sudo wg show ${iface}`);
    return true;
  } catch {
    return false;
  }
}

export async function startInterface(iface: string): Promise<void> {
  await runAsync(`sudo wg-quick up ${iface}`);
}

export async function stopInterface(iface: string): Promise<void> {
  await runAsync(`sudo wg-quick down ${iface}`);
}

export async function restartInterface(iface: string): Promise<void> {
  try { await stopInterface(iface); } catch {}
  await startInterface(iface);
}

export async function addPeerToInterface(
  iface: string,
  publicKey: string,
  presharedKey: string,
  allowedIps: string
): Promise<void> {
  if (presharedKey) {
    const tmpFile = `/tmp/wg-psk-${Date.now()}`;
    writeFileSync(tmpFile, presharedKey + '\n', { mode: 0o600 });
    try {
      await runAsync(`sudo wg set ${iface} peer ${publicKey} preshared-key ${tmpFile} allowed-ips ${allowedIps}`);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  } else {
    await runAsync(`sudo wg set ${iface} peer ${publicKey} allowed-ips ${allowedIps}`);
  }
}

export async function removePeerFromInterface(iface: string, publicKey: string): Promise<void> {
  await runAsync(`sudo wg set ${iface} peer ${publicKey} remove`);
}

export async function generatePrivateKey(): Promise<string> {
  return runAsync('wg genkey');
}

export async function derivePublicKey(privateKey: string): Promise<string> {
  return runAsync(`echo '${privateKey}' | wg pubkey`);
}

export async function generatePresharedKey(): Promise<string> {
  return runAsync('wg genpsk');
}

export async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  const privateKey = await generatePrivateKey();
  const publicKey = await derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function writeWireGuardConfig(iface: string, content: string): Promise<void> {
  // Write to a temp file first, then sudo move it into /etc/wireguard/
  const tmpFile = `/tmp/wg-conf-${Date.now()}`;
  writeFileSync(tmpFile, content, { mode: 0o600 });
  try {
    await runAsync(`sudo cp ${tmpFile} /etc/wireguard/${iface}.conf && sudo chmod 600 /etc/wireguard/${iface}.conf`);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}
