const TOKEN_KEY = 'yf_auth_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Unauthorized');
  }
  return res.json();
}

// Auth
export const api = {
  auth: {
    login: async (password: string) => {
      const result = await request<{ success: boolean; token?: string; error?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      if (result.success && result.token) {
        setToken(result.token);
      }
      return result;
    },
    logout: async () => {
      const result = await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
      clearToken();
      return result;
    },
    session: () =>
      request<{ authenticated: boolean }>('/api/auth/session'),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean; error?: string }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },

  peers: {
    list: () => request<PeerWithStats[]>('/api/peers'),
    create: (data: { name: string; email?: string; dns?: string; allowedIps?: string; persistentKeepalive?: number }) =>
      request<{ id: string; address: string; publicKey: string }>('/api/peers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, any>) =>
      request<{ success: boolean }>(`/api/peers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/peers/${id}`, { method: 'DELETE' }),
    toggle: (id: string, enabled: boolean) =>
      request<{ success: boolean }>(`/api/peers/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    qrcode: (id: string) =>
      request<{ dataUrl: string; config: string }>(`/api/peers/${id}/qrcode`),
    config: (id: string) =>
      request<{ config: string; filename: string }>(`/api/peers/${id}/config`),
    setupScript: (id: string) =>
      request<{ script: string; hasSshKey: boolean }>(`/api/peers/${id}/setup-script`),
  },

  server: {
    check: () => request<WireGuardCheck>('/api/server/check'),
    status: () => request<ServerStatus>('/api/server/status'),
    config: () => request<Record<string, string>>('/api/server/config'),
    updateConfig: (data: Record<string, string>) =>
      request<{ success: boolean }>('/api/server/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    generateKeys: (force = false) =>
      request<{ publicKey: string; alreadyExisted: boolean }>('/api/server/keys', {
        method: 'POST',
        body: JSON.stringify({ force }),
      }),
    start: () => request<{ success: boolean }>('/api/server/start', { method: 'POST' }),
    stop: () => request<{ success: boolean }>('/api/server/stop', { method: 'POST' }),
    restart: () => request<{ success: boolean }>('/api/server/restart', { method: 'POST' }),
    publicIp: () => request<{ ip: string | null; error?: string }>('/api/server/public-ip'),
    localIp: () => request<{ ip: string | null; error?: string }>('/api/server/public-ip?type=local'),
    firewall: () => request<FirewallStatus>('/api/server/firewall'),
    addFirewallPort: (port: number, protocol: 'tcp' | 'udp') =>
      request<{ success: boolean; message: string }>('/api/server/firewall', {
        method: 'POST',
        body: JSON.stringify({ port, protocol }),
      }),
    removeFirewallPort: (port: number, protocol: 'tcp' | 'udp') =>
      request<{ success: boolean; message: string }>('/api/server/firewall', {
        method: 'DELETE',
        body: JSON.stringify({ port, protocol }),
      }),
    detectSshKey: () =>
      request<{ key: string; generated: boolean }>('/api/server/ssh-key', { method: 'POST' }),
  },

  dns: {
    status: () => request<DnsStatus>('/api/server/dns'),
    action: (action: string) =>
      request<{ success: boolean; message: string }>('/api/server/dns', {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    addRecord: (hostname: string, ip: string) =>
      request<{ success: boolean; message: string }>('/api/server/dns', {
        method: 'POST',
        body: JSON.stringify({ action: 'add-record', hostname, ip }),
      }),
    deleteRecord: (hostname: string, ip: string) =>
      request<{ success: boolean; message: string }>('/api/server/dns', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete-record', hostname, ip }),
      }),
  },

  stats: {
    global: (range: string) =>
      request<TrafficDataPoint[]>(`/api/stats?range=${range}`),
    peer: (peerId: string, range: string) =>
      request<TrafficDataPoint[]>(`/api/stats/${peerId}?range=${range}`),
  },
};

// Types
export interface PeerWithStats {
  id: string;
  name: string;
  email: string;
  device: string;
  publicKey: string;
  allowedIps: string;
  address: string;
  dns: string;
  persistentKeepalive: number;
  enabled: boolean;
  networkType: 'local' | 'remote';
  createdAt: string;
  updatedAt: string;
  connected: boolean;
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
  endpoint: string;
}

export interface ServerStatus {
  running: boolean;
  interface: string;
  publicKey: string;
  listenPort: number;
  address: string;
  endpoint: string;
  connectedPeers: number;
  totalPeers: number;
}

export interface WireGuardCheck {
  wgInstalled: boolean;
  wgToolsInstalled: boolean;
  wgVersion: string | null;
  sudoAccess: boolean;
  isRoot: boolean;
}

export interface TrafficDataPoint {
  rx_bytes: number;
  tx_bytes: number;
  recorded_at: string;
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

export interface DnsmasqStatus {
  installed: boolean;
  running: boolean;
  configExists: boolean;
  version: string;
}

export interface DnsRecord {
  hostname: string;
  ip: string;
}

export interface DnsAvailableTarget {
  ip: string;
  name: string;
}

export interface DnsStatus {
  dnsmasq: DnsmasqStatus;
  records: DnsRecord[];
  availableTargets: DnsAvailableTarget[];
}

