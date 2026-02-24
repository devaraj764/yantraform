import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('setup_commands'))) {
    await knex.schema.createTable('setup_commands', (t) => {
      t.increments('id').primary();
      t.text('os_type').notNullable();
      t.text('command_type').notNullable();
      t.text('command').notNullable();
      t.integer('sort_order').notNullable().defaultTo(0);
    });

    await knex.schema.table('setup_commands', (t) => {
      t.index(['os_type', 'command_type'], 'idx_setup_os_cmd');
    });
  }

  // Seed default commands
  const distros = ['ubuntu', 'debian', 'fedora', 'centos', 'arch', 'alpine'];

  const installCmds: Record<string, string> = {
    ubuntu: 'sudo apt-get update && sudo apt-get install -y wireguard',
    debian: 'sudo apt-get update && sudo apt-get install -y wireguard',
    fedora: 'sudo dnf install -y wireguard-tools',
    centos: 'sudo yum install -y epel-release && sudo yum install -y wireguard-tools',
    arch: 'sudo pacman -Sy --noconfirm wireguard-tools',
    alpine: 'sudo apk add wireguard-tools',
  };

  const writeConfigCmd = "sudo mkdir -p /etc/wireguard && sudo tee /etc/wireguard/wg0.conf > /dev/null << 'WGCONF'\n{{CONFIG}}\nWGCONF\nsudo chmod 600 /etc/wireguard/wg0.conf";

  const enableCmds: Record<string, string> = {
    ubuntu: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
    debian: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
    fedora: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
    centos: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
    arch: 'sudo systemctl enable wg-quick@wg0 && sudo systemctl start wg-quick@wg0',
    alpine: 'sudo rc-update add wg-quick.wg0 default && sudo rc-service wg-quick.wg0 start',
  };

  const sshKeyCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qF '{{SSH_KEY}}' ~/.ssh/authorized_keys 2>/dev/null || echo '{{SSH_KEY}}' >> ~/.ssh/authorized_keys)";

  const verifyCmd = 'sudo wg show wg0';

  const rows: { os_type: string; command_type: string; command: string; sort_order: number }[] = [];

  for (const os of distros) {
    rows.push({ os_type: os, command_type: 'install', command: installCmds[os], sort_order: 1 });
    rows.push({ os_type: os, command_type: 'write_config', command: writeConfigCmd, sort_order: 2 });
    rows.push({ os_type: os, command_type: 'enable', command: enableCmds[os], sort_order: 3 });
    rows.push({ os_type: os, command_type: 'ssh_key', command: sshKeyCmd, sort_order: 4 });
    rows.push({ os_type: os, command_type: 'verify', command: verifyCmd, sort_order: 5 });
  }

  await knex('setup_commands').insert(rows);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('setup_commands');
}
