import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const exec = promisify(execCb);

const EXEC_TIMEOUT = 60_000;

// Standalone config — NOT in /etc/dnsmasq.d/ to avoid merging with libvirt etc.
const DNSMASQ_CONFIG_PATH = '/etc/yantraform-dns.conf';
const DNSMASQ_SERVICE_NAME = 'yantraform-dns';
const DNSMASQ_SERVICE_PATH = `/etc/systemd/system/${DNSMASQ_SERVICE_NAME}.service`;

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await exec(cmd, { timeout: EXEC_TIMEOUT });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function runCmdOrThrow(cmd: string): Promise<string> {
  const { stdout } = await exec(cmd, { timeout: EXEC_TIMEOUT });
  return stdout.trim();
}

function buildServiceUnit(): string {
  // --conf-file reads ONLY our config (no defaults, no /etc/dnsmasq.d/)
  // --keep-in-foreground for Type=simple (no PID file needed)
  return `[Unit]
Description=Yantraform DNS (dnsmasq)
After=network.target sys-devices-virtual-net-wg0.device
Wants=sys-devices-virtual-net-wg0.device

[Service]
Type=simple
ExecStartPre=/usr/sbin/dnsmasq --test --conf-file=${DNSMASQ_CONFIG_PATH}
ExecStart=/usr/sbin/dnsmasq --keep-in-foreground --conf-file=${DNSMASQ_CONFIG_PATH}
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
`;
}

function buildDnsmasqConfig(wgInterface: string): string {
  return [
    '# Managed by Yantraform — do not edit',
    `interface=${wgInterface}`,
    'bind-dynamic',
    'no-hosts',
    'addn-hosts=/etc/hosts',
    'no-resolv',
    'server=1.1.1.1',
    'server=1.0.0.1',
    '',
  ].join('\n');
}

export interface DnsmasqStatus {
  installed: boolean;
  running: boolean;
  configExists: boolean;
  version: string;
}

export interface DnsMutationResult {
  success: boolean;
  message: string;
}

export async function getDnsmasqStatus(): Promise<DnsmasqStatus> {
  const whichOutput = await runCmd('which dnsmasq');
  const installed = whichOutput !== '';

  let running = false;
  const activeOutput = await runCmd(`systemctl is-active ${DNSMASQ_SERVICE_NAME}`);
  running = activeOutput === 'active';

  const configExists = existsSync(DNSMASQ_CONFIG_PATH);

  let version = '';
  if (installed) {
    const versionOutput = await runCmd('dnsmasq --version');
    const match = versionOutput.match(/Dnsmasq version ([\d.]+)/i);
    if (match) version = match[1];
  }

  return { installed, running, configExists, version };
}

async function ensureDnsmasqBinary(): Promise<void> {
  const whichOutput = await runCmd('which dnsmasq');
  if (whichOutput) return;

  const hasApt = await runCmd('which apt-get');
  const hasDnf = await runCmd('which dnf');
  const hasYum = await runCmd('which yum');
  const hasPacman = await runCmd('which pacman');

  if (hasApt) {
    await runCmdOrThrow('sudo DEBIAN_FRONTEND=noninteractive apt-get install -y dnsmasq-base');
  } else if (hasDnf) {
    await runCmdOrThrow('sudo dnf install -y dnsmasq');
  } else if (hasYum) {
    await runCmdOrThrow('sudo yum install -y dnsmasq');
  } else if (hasPacman) {
    await runCmdOrThrow('sudo pacman -S --noconfirm dnsmasq');
  } else {
    throw new Error('No supported package manager found (apt, dnf, yum, pacman)');
  }

  const verify = await runCmd('which dnsmasq');
  if (!verify) {
    throw new Error('dnsmasq binary not found after install');
  }
}

async function writeTmpAndCopy(content: string, dest: string): Promise<void> {
  const tmpFile = `/tmp/yantraform-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tmpFile, content, { mode: 0o644 });
  try {
    await runCmdOrThrow(`sudo cp ${tmpFile} ${dest}`);
  } finally {
    await runCmd(`rm -f ${tmpFile}`);
  }
}

export async function setupDnsmasq(wgInterface: string): Promise<DnsMutationResult> {
  try {
    await ensureDnsmasqBinary();

    // Clean stop any previous attempt
    await runCmd(`sudo systemctl stop ${DNSMASQ_SERVICE_NAME}`);
    await runCmd(`sudo systemctl disable ${DNSMASQ_SERVICE_NAME}`);
    await runCmd(`sudo systemctl reset-failed ${DNSMASQ_SERVICE_NAME}`);

    // Also clean up old /etc/dnsmasq.d/yantraform and dnsmasq.service if we left them
    await runCmd('sudo rm -f /etc/dnsmasq.d/yantraform');
    await runCmd('sudo systemctl stop dnsmasq');
    await runCmd('sudo systemctl disable dnsmasq');
    if (existsSync('/etc/systemd/system/dnsmasq.service')) {
      await runCmd('sudo rm -f /etc/systemd/system/dnsmasq.service');
    }

    // Write standalone config
    await writeTmpAndCopy(buildDnsmasqConfig(wgInterface), DNSMASQ_CONFIG_PATH);

    // Write dedicated service file
    await writeTmpAndCopy(buildServiceUnit(), DNSMASQ_SERVICE_PATH);
    await runCmdOrThrow('sudo systemctl daemon-reload');

    // Enable and start
    await runCmdOrThrow(`sudo systemctl enable ${DNSMASQ_SERVICE_NAME}`);
    await runCmdOrThrow(`sudo systemctl start ${DNSMASQ_SERVICE_NAME}`);

    return { success: true, message: 'dnsmasq configured and started' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to setup dnsmasq' };
  }
}

export async function startDnsmasq(): Promise<DnsMutationResult> {
  try {
    await runCmdOrThrow(`sudo systemctl start ${DNSMASQ_SERVICE_NAME}`);
    return { success: true, message: 'dnsmasq started' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to start dnsmasq' };
  }
}

export async function stopDnsmasq(): Promise<DnsMutationResult> {
  try {
    await runCmdOrThrow(`sudo systemctl stop ${DNSMASQ_SERVICE_NAME}`);
    return { success: true, message: 'dnsmasq stopped' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to stop dnsmasq' };
  }
}

export async function restartDnsmasq(): Promise<DnsMutationResult> {
  try {
    await runCmdOrThrow(`sudo systemctl restart ${DNSMASQ_SERVICE_NAME}`);
    return { success: true, message: 'dnsmasq restarted' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to restart dnsmasq' };
  }
}

// --- DNS record management (address= directives in config) ---

export interface DnsRecord {
  hostname: string;
  ip: string;
}

function readConfig(): string {
  if (!existsSync(DNSMASQ_CONFIG_PATH)) return '';
  return readFileSync(DNSMASQ_CONFIG_PATH, 'utf-8');
}

async function writeConfig(content: string): Promise<void> {
  await writeTmpAndCopy(content, DNSMASQ_CONFIG_PATH);
}

async function reloadDnsmasq(): Promise<void> {
  await runCmdOrThrow(`sudo systemctl reload-or-restart ${DNSMASQ_SERVICE_NAME}`);
}

export function getDnsRecords(): DnsRecord[] {
  const content = readConfig();
  const records: DnsRecord[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^address=\/(.+?)\/(.+)$/);
    if (match) {
      records.push({ hostname: match[1], ip: match[2] });
    }
  }
  return records;
}

export async function addDnsRecord(hostname: string, ip: string): Promise<DnsMutationResult> {
  try {
    const content = readConfig();
    const directive = `address=/${hostname}/${ip}`;
    // Avoid duplicates
    if (content.includes(directive)) {
      return { success: false, message: 'Record already exists' };
    }
    const newContent = content.trimEnd() + '\n' + directive + '\n';
    await writeConfig(newContent);
    await reloadDnsmasq();
    return { success: true, message: `Added ${hostname} → ${ip}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to add DNS record' };
  }
}

export async function deleteDnsRecord(hostname: string, ip: string): Promise<DnsMutationResult> {
  try {
    const content = readConfig();
    const directive = `address=/${hostname}/${ip}`;
    const lines = content.split('\n');
    const filtered = lines.filter((line) => line !== directive);
    if (lines.length === filtered.length) {
      return { success: false, message: 'Record not found' };
    }
    await writeConfig(filtered.join('\n'));
    await reloadDnsmasq();
    return { success: true, message: `Removed ${hostname} → ${ip}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to delete DNS record' };
  }
}
