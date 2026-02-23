import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('settings'))) {
    await knex.schema.createTable('settings', (t) => {
      t.text('key').primary();
      t.text('value').notNullable();
    });
  }

  if (!(await knex.schema.hasTable('peers'))) {
    await knex.schema.createTable('peers', (t) => {
      t.text('id').primary();
      t.text('name').notNullable();
      t.text('email').defaultTo('');
      t.text('private_key').notNullable();
      t.text('public_key').notNullable();
      t.text('preshared_key').defaultTo('');
      t.text('allowed_ips').notNullable().defaultTo('0.0.0.0/0, ::/0');
      t.text('address').notNullable();
      t.text('dns').defaultTo('');
      t.integer('persistent_keepalive').defaultTo(25);
      t.integer('enabled').notNullable().defaultTo(1);
      t.text('device').defaultTo('');
      t.text('network_type').notNullable().defaultTo('remote');
      t.text('access_key').defaultTo('');
      t.text('peer_type').notNullable().defaultTo('peer');
      t.text('hostname').defaultTo('');
      t.text('created_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
      t.text('updated_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    });
  }

  if (!(await knex.schema.hasTable('traffic_stats'))) {
    await knex.schema.createTable('traffic_stats', (t) => {
      t.increments('id').primary();
      t.text('peer_public_key').notNullable();
      t.integer('rx_bytes').notNullable().defaultTo(0);
      t.integer('tx_bytes').notNullable().defaultTo(0);
      t.text('recorded_at').notNullable().defaultTo(knex.raw("(datetime('now'))"));
    });

    await knex.schema.table('traffic_stats', (t) => {
      t.index('peer_public_key', 'idx_traffic_peer');
      t.index('recorded_at', 'idx_traffic_time');
    });
  }

  // Seed default settings
  const defaults: Record<string, string> = {
    server_address: '10.8.0.1/24',
    server_port: '51820',
    server_dns: '1.1.1.1, 1.0.0.1',
    server_endpoint: '',
    server_interface: 'wg0',
    server_private_key: '',
    server_public_key: '',
    server_post_up:
      "iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o $(ip route show default | awk '{print $5}') -j MASQUERADE; sysctl -w net.ipv4.ip_forward=1",
    server_post_down:
      "iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o $(ip route show default | awk '{print $5}') -j MASQUERADE",
    server_local_ip: '',
    server_hostname: '',
    admin_password_hash: '',
    ip_range: '10.8.0.0/24',
  };

  for (const [key, value] of Object.entries(defaults)) {
    const exists = await knex('settings').where({ key }).first();
    if (!exists) {
      await knex('settings').insert({ key, value });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('traffic_stats');
  await knex.schema.dropTableIfExists('peers');
  await knex.schema.dropTableIfExists('settings');
}
