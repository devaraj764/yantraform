import type { Knex } from 'knex';
import { join } from 'node:path';

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: join(process.cwd(), 'data', 'yantraform.db'),
  },
  useNullAsDefault: true,
  migrations: {
    directory: join(__dirname, 'src', 'migrations'),
    extension: 'ts',
  },
};

export default config;
