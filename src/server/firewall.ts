import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

const EXEC_TIMEOUT = 10_000;

async function runCmd(cmd: string): Promise<string> {
  try {
    const { stdout } = await exec(cmd, { timeout: EXEC_TIMEOUT });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function runCmdStrict(cmd: string): Promise<string> {
  const { stdout, stderr } = await exec(cmd, { timeout: EXEC_TIMEOUT });
  if (stderr && stderr.trim()) {
    throw new Error(stderr.trim());
  }
  return stdout.trim();
}

export interface FirewallMutationResult {
  success: boolean;
  message: string;
}

export async function addFirewallPort(
  firewallType: FirewallInfo['type'],
  port: number,
  protocol: 'tcp' | 'udp',
): Promise<FirewallMutationResult> {
  try {
    switch (firewallType) {
      case 'ufw':
        await runCmdStrict(`sudo ufw allow ${port}/${protocol}`);
        break;
      case 'firewalld':
        await runCmdStrict(
          `sudo firewall-cmd --permanent --add-port=${port}/${protocol} && sudo firewall-cmd --reload`,
        );
        break;
      case 'iptables':
        await runCmdStrict(
          `sudo iptables -A INPUT -p ${protocol} --dport ${port} -j ACCEPT`,
        );
        break;
      case 'nftables':
        await runCmdStrict(
          `sudo nft add rule inet filter input ${protocol} dport ${port} accept`,
        );
        break;
      case 'none':
        return { success: false, message: 'No firewall detected to manage' };
    }
    return { success: true, message: `Allowed port ${port}/${protocol}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to add firewall rule' };
  }
}

export async function removeFirewallPort(
  firewallType: FirewallInfo['type'],
  port: number,
  protocol: 'tcp' | 'udp',
): Promise<FirewallMutationResult> {
  try {
    switch (firewallType) {
      case 'ufw':
        await runCmdStrict(`sudo ufw delete allow ${port}/${protocol}`);
        break;
      case 'firewalld':
        await runCmdStrict(
          `sudo firewall-cmd --permanent --remove-port=${port}/${protocol} && sudo firewall-cmd --reload`,
        );
        break;
      case 'iptables':
        await runCmdStrict(
          `sudo iptables -D INPUT -p ${protocol} --dport ${port} -j ACCEPT`,
        );
        break;
      case 'nftables': {
        // nftables requires finding the handle for the rule to delete it
        const ruleset = await runCmdStrict('sudo nft -a list ruleset');
        const handleMatch = ruleset.match(
          new RegExp(`${protocol} dport ${port} accept # handle (\\d+)`),
        );
        if (!handleMatch) {
          return { success: false, message: `Could not find nftables rule for port ${port}/${protocol}` };
        }
        await runCmdStrict(
          `sudo nft delete rule inet filter input handle ${handleMatch[1]}`,
        );
        break;
      }
      case 'none':
        return { success: false, message: 'No firewall detected to manage' };
    }
    return { success: true, message: `Removed port ${port}/${protocol}` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to remove firewall rule' };
  }
}

export interface ListeningPort {
  protocol: 'tcp' | 'udp';
  port: number;
  address: string;
  process: string;
  state: string;
}

export interface FirewallRule {
  port: number;
  protocol: 'tcp' | 'udp';
  action: 'allow' | 'deny' | 'reject' | 'limit';
}

export interface FirewallInfo {
  type: 'ufw' | 'firewalld' | 'nftables' | 'iptables' | 'none';
  active: boolean;
  version: string;
}

export interface FirewallStatus {
  firewall: FirewallInfo;
  rules: string;
  parsedRules: FirewallRule[];
}

function parseSsOutput(output: string, protocol: 'tcp' | 'udp'): ListeningPort[] {
  const lines = output.split('\n');
  const ports: ListeningPort[] = [];

  // Skip the header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ss output columns: State  Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const state = parts[0];
    const localAddr = parts[3];

    // Use lastIndexOf(':') for IPv6 support (e.g. [::]:22 or :::22)
    const lastColon = localAddr.lastIndexOf(':');
    if (lastColon === -1) continue;

    const address = localAddr.substring(0, lastColon);
    const portNum = parseInt(localAddr.substring(lastColon + 1), 10);
    if (isNaN(portNum)) continue;

    // Extract process name from the "users:(("name",pid=X,fd=Y))" field
    let process = '';
    const fullLine = lines[i];
    const usersMatch = fullLine.match(/users:\(\("([^"]+)"/);
    if (usersMatch) {
      process = usersMatch[1];
    }

    ports.push({
      protocol,
      port: portNum,
      address: address || '*',
      process,
      state: protocol === 'udp' ? 'UNCONN' : state,
    });
  }

  return ports;
}

export async function getListeningPorts(): Promise<ListeningPort[]> {
  const [tcpOutput, udpOutput] = await Promise.all([
    runCmd('sudo ss -tlnp'),
    runCmd('sudo ss -ulnp'),
  ]);

  const tcpPorts = tcpOutput ? parseSsOutput(tcpOutput, 'tcp') : [];
  const udpPorts = udpOutput ? parseSsOutput(udpOutput, 'udp') : [];

  return [...tcpPorts, ...udpPorts].sort((a, b) => a.port - b.port);
}

export async function detectFirewall(): Promise<FirewallInfo> {
  // Check ufw
  const ufwOutput = await runCmd('sudo ufw status');
  if (ufwOutput && !ufwOutput.includes('not found')) {
    const active = ufwOutput.includes('Status: active');
    let version = '';
    const versionOutput = await runCmd('ufw version');
    const vMatch = versionOutput.match(/ufw ([\d.]+)/);
    if (vMatch) version = vMatch[1];
    return { type: 'ufw', active, version };
  }

  // Check firewalld
  const firewalldOutput = await runCmd('sudo firewall-cmd --state');
  if (firewalldOutput && !firewalldOutput.includes('not found')) {
    const active = firewalldOutput.includes('running');
    let version = '';
    const versionOutput = await runCmd('firewall-cmd --version');
    if (versionOutput) version = versionOutput;
    return { type: 'firewalld', active, version };
  }

  // Check nftables
  const nftOutput = await runCmd('sudo nft list ruleset');
  if (nftOutput !== '') {
    let version = '';
    const versionOutput = await runCmd('nft --version');
    const vMatch = versionOutput.match(/nftables v?([\d.]+)/);
    if (vMatch) version = vMatch[1];
    return { type: 'nftables', active: true, version };
  }

  // Check iptables
  const iptOutput = await runCmd('sudo iptables -L -n');
  if (iptOutput && !iptOutput.includes('not found')) {
    // iptables is always "active" if installed, check if there are real rules
    const hasRules = iptOutput.split('\n').length > 8;
    let version = '';
    const versionOutput = await runCmd('iptables --version');
    const vMatch = versionOutput.match(/v([\d.]+)/);
    if (vMatch) version = vMatch[1];
    return { type: 'iptables', active: hasRules, version };
  }

  return { type: 'none', active: false, version: '' };
}

export async function getFirewallRules(type: FirewallInfo['type']): Promise<string> {
  switch (type) {
    case 'ufw':
      return runCmd('sudo ufw status verbose');
    case 'firewalld':
      return runCmd('sudo firewall-cmd --list-all');
    case 'nftables':
      return runCmd('sudo nft list ruleset');
    case 'iptables':
      return runCmd('sudo iptables -L -n -v');
    default:
      return 'No firewall detected';
  }
}

function normalizeAction(raw: string): FirewallRule['action'] {
  const lower = raw.toLowerCase();
  if (lower.startsWith('allow') || lower === 'accept') return 'allow';
  if (lower.startsWith('deny') || lower === 'drop') return 'deny';
  if (lower.startsWith('reject')) return 'reject';
  if (lower.startsWith('limit')) return 'limit';
  return 'allow';
}

export function parseFirewallRules(type: FirewallInfo['type'], rawRules: string): FirewallRule[] {
  const rules: FirewallRule[] = [];
  const seen = new Set<string>();

  const addRule = (port: number, protocol: 'tcp' | 'udp', action: FirewallRule['action']) => {
    const key = `${port}/${protocol}`;
    if (!seen.has(key)) {
      seen.add(key);
      rules.push({ port, protocol, action });
    }
  };

  switch (type) {
    case 'ufw': {
      // Lines like: "22/tcp  ALLOW IN  Anywhere" or "80  ALLOW  Anywhere"
      // Skip v6 duplicates
      for (const line of rawRules.split('\n')) {
        if (line.includes('(v6)')) continue;
        const match = line.match(/^(\d+)(?:\/(tcp|udp))?\s+(ALLOW|DENY|REJECT|LIMIT)/i);
        if (!match) continue;
        const port = parseInt(match[1], 10);
        const action = normalizeAction(match[3]);
        if (match[2]) {
          addRule(port, match[2].toLowerCase() as 'tcp' | 'udp', action);
        } else {
          // No protocol specified means both
          addRule(port, 'tcp', action);
          addRule(port, 'udp', action);
        }
      }
      break;
    }
    case 'firewalld': {
      // Look for "ports:" line, e.g. "ports: 22/tcp 80/tcp 443/tcp"
      const portsMatch = rawRules.match(/ports:\s*(.+)/);
      if (portsMatch) {
        const entries = portsMatch[1].trim().split(/\s+/);
        for (const entry of entries) {
          const m = entry.match(/^(\d+)\/(tcp|udp)$/);
          if (m) {
            addRule(parseInt(m[1], 10), m[2] as 'tcp' | 'udp', 'allow');
          }
        }
      }
      break;
    }
    case 'iptables': {
      // Lines like: "ACCEPT  tcp  --  0.0.0.0/0  0.0.0.0/0  tcp dpt:22"
      for (const line of rawRules.split('\n')) {
        const match = line.match(/(ACCEPT|DROP|REJECT)\s+(tcp|udp)\s+.*dpt:(\d+)/i);
        if (match) {
          addRule(
            parseInt(match[3], 10),
            match[2].toLowerCase() as 'tcp' | 'udp',
            normalizeAction(match[1]),
          );
        }
      }
      break;
    }
    case 'nftables': {
      // Lines like: "tcp dport 22 accept"
      for (const line of rawRules.split('\n')) {
        const match = line.match(/(tcp|udp)\s+dport\s+(\d+)\s+(accept|drop|reject)/i);
        if (match) {
          addRule(
            parseInt(match[2], 10),
            match[1].toLowerCase() as 'tcp' | 'udp',
            normalizeAction(match[3]),
          );
        }
      }
      break;
    }
  }

  return rules.sort((a, b) => a.port - b.port);
}

export async function getFirewallStatus(): Promise<FirewallStatus> {
  const firewall = await detectFirewall();
  const rules = await getFirewallRules(firewall.type);
  const parsedRules = parseFirewallRules(firewall.type, rules);

  return { firewall, rules, parsedRules };
}
