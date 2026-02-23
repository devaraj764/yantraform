import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex('peers').where({ peer_type: 'provider' }).update({ peer_type: 'agent' });
  await knex('peers').where({ peer_type: 'consumer' }).update({ peer_type: 'peer' });
}

export async function down(knex: Knex): Promise<void> {
  await knex('peers').where({ peer_type: 'agent' }).update({ peer_type: 'provider' });
  await knex('peers').where({ peer_type: 'peer' }).update({ peer_type: 'consumer' });
}
