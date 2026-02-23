import knex, { type Knex } from 'knex';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

let _knex: Knex | null = null;
let _migrated = false;

// Import migrations inline so Nitro bundles them (no filesystem lookup at runtime)
import * as initialSchema from '../migrations/20260222000000_initial_schema';
import * as renamePeerTypes from '../migrations/20260223000000_rename_peer_types';

const inlineMigrations = [
  { name: '20260222000000_initial_schema', migration: initialSchema },
  { name: '20260223000000_rename_peer_types', migration: renamePeerTypes },
];

class InlineMigrationSource implements Knex.MigrationSource<{ name: string; migration: any }> {
  getMigrations(): Promise<{ name: string; migration: any }[]> {
    return Promise.resolve(inlineMigrations);
  }
  getMigrationName(migration: { name: string }): string {
    return migration.name;
  }
  getMigration(migration: { migration: any }): Promise<Knex.Migration> {
    return Promise.resolve(migration.migration);
  }
}

function getKnex(): Knex {
  if (_knex) return _knex;

  const DATA_DIR = join(process.cwd(), 'data');
  mkdirSync(DATA_DIR, { recursive: true });

  _knex = knex({
    client: 'better-sqlite3',
    connection: {
      filename: join(DATA_DIR, 'yantraform.db'),
    },
    useNullAsDefault: true,
    pool: {
      afterCreate(conn: any, done: (err: Error | null, conn: any) => void) {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        done(null, conn);
      },
    },
  });

  return _knex;
}

async function ensureMigrated(): Promise<Knex> {
  const db = getKnex();
  if (!_migrated) {
    await db.migrate.latest({
      migrationSource: new InlineMigrationSource(),
    });
    _migrated = true;
  }
  return db;
}

// --- Settings ---
export async function getSetting(key: string): Promise<string | null> {
  const db = await ensureMigrated();
  const row = await db('settings').where({ key }).first();
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await ensureMigrated();
  const exists = await db('settings').where({ key }).first();
  if (exists) {
    await db('settings').where({ key }).update({ value });
  } else {
    await db('settings').insert({ key, value });
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await ensureMigrated();
  const rows = await db('settings').select('key', 'value');
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}

// --- Peers ---
export interface PeerRow {
  id: string;
  name: string;
  email: string;
  private_key: string;
  public_key: string;
  preshared_key: string;
  access_key: string;
  allowed_ips: string;
  address: string;
  dns: string;
  persistent_keepalive: number;
  enabled: number;
  device: string;
  network_type: 'local' | 'remote';
  peer_type: 'agent' | 'peer';
  hostname: string;
  created_at: string;
  updated_at: string;
}

export async function getAllPeers(): Promise<PeerRow[]> {
  const db = await ensureMigrated();
  return db('peers').select('*').orderBy('created_at', 'desc');
}

export async function getPeerById(id: string): Promise<PeerRow | null> {
  const db = await ensureMigrated();
  const row = await db('peers').where({ id }).first();
  return row ?? null;
}

export async function getPeerByPublicKey(pk: string): Promise<PeerRow | null> {
  const db = await ensureMigrated();
  const row = await db('peers').where({ public_key: pk }).first();
  return row ?? null;
}

export function generateAccessKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createPeer(peer: Omit<PeerRow, 'created_at' | 'updated_at'>): Promise<void> {
  const db = await ensureMigrated();
  await db('peers').insert(peer);
}

export async function updatePeer(
  id: string,
  updates: Partial<Pick<PeerRow, 'name' | 'email' | 'allowed_ips' | 'dns' | 'persistent_keepalive' | 'enabled' | 'device' | 'network_type' | 'peer_type' | 'hostname'>>
): Promise<void> {
  const db = await ensureMigrated();
  const fields: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields[key] = value as string | number;
    }
  }
  if (Object.keys(fields).length === 0) return;
  fields.updated_at = new Date().toISOString().replace('T', ' ').split('.')[0];
  await db('peers').where({ id }).update(fields);
}

export async function deletePeer(id: string): Promise<void> {
  const db = await ensureMigrated();
  const peer = await getPeerById(id);
  if (peer) {
    await db('traffic_stats').where({ peer_public_key: peer.public_key }).del();
  }
  await db('peers').where({ id }).del();
}

// --- Traffic Stats ---
export async function recordTrafficStats(peerPublicKey: string, rxBytes: number, txBytes: number): Promise<void> {
  const db = await ensureMigrated();
  await db('traffic_stats').insert({
    peer_public_key: peerPublicKey,
    rx_bytes: rxBytes,
    tx_bytes: txBytes,
  });
}

export async function getTrafficStats(
  peerPublicKey: string,
  since: string
): Promise<{ rx_bytes: number; tx_bytes: number; recorded_at: string }[]> {
  const db = await ensureMigrated();
  return db('traffic_stats')
    .select('rx_bytes', 'tx_bytes', 'recorded_at')
    .where('peer_public_key', peerPublicKey)
    .andWhere('recorded_at', '>=', since)
    .orderBy('recorded_at', 'asc');
}

export async function getGlobalTrafficStats(
  since: string
): Promise<{ rx_bytes: number; tx_bytes: number; recorded_at: string }[]> {
  const db = await ensureMigrated();
  return db('traffic_stats')
    .select(db.raw('SUM(rx_bytes) as rx_bytes, SUM(tx_bytes) as tx_bytes, recorded_at'))
    .where('recorded_at', '>=', since)
    .groupBy('recorded_at')
    .orderBy('recorded_at', 'asc');
}

// --- IP allocation ---
export async function getNextAvailableIP(): Promise<string> {
  const serverAddr = (await getSetting('server_address')) || '10.8.0.1/24';
  const [baseIP] = serverAddr.split('/');
  const parts = baseIP.split('.').map(Number);
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const peers = await getAllPeers();
  const used = new Set<number>([parts[3]]);
  for (const p of peers) {
    const last = parseInt(p.address.split('/')[0].split('.')[3], 10);
    used.add(last);
  }

  for (let i = 2; i < 255; i++) {
    if (!used.has(i)) return `${prefix}.${i}/32`;
  }
  throw new Error('No available IP addresses');
}

export async function cleanupOldStats(): Promise<void> {
  const db = await ensureMigrated();
  await db('traffic_stats')
    .whereRaw("recorded_at < datetime('now', '-30 days')")
    .del();
}
