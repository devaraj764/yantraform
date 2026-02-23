import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { getAllPeers } from './db';
import { generateHostsEntries } from './config';

const BEGIN_MARKER = '# BEGIN yantraform';
const END_MARKER = '# END yantraform';

export async function updateHostsFile(): Promise<void> {
  const peers = await getAllPeers();
  const entries = await generateHostsEntries(peers);

  let hosts: string;
  try {
    hosts = readFileSync('/etc/hosts', 'utf-8');
  } catch {
    return;
  }

  const beginIdx = hosts.indexOf(BEGIN_MARKER);
  const endIdx = hosts.indexOf(END_MARKER);

  let newHosts: string;
  const block = entries
    ? `${BEGIN_MARKER}\n${entries}\n${END_MARKER}`
    : `${BEGIN_MARKER}\n${END_MARKER}`;

  if (beginIdx !== -1 && endIdx !== -1) {
    // Replace existing block
    newHosts =
      hosts.substring(0, beginIdx) +
      block +
      hosts.substring(endIdx + END_MARKER.length);
  } else {
    // Append new block
    newHosts = hosts.trimEnd() + '\n\n' + block + '\n';
  }

  // Write via temp file + sudo cp to handle permissions
  const tmpFile = `/tmp/yantraform-hosts-${Date.now()}`;
  writeFileSync(tmpFile, newHosts, { mode: 0o644 });
  try {
    execSync(`sudo cp ${tmpFile} /etc/hosts`, { encoding: 'utf-8' });
  } finally {
    try {
      execSync(`rm -f ${tmpFile}`, { encoding: 'utf-8' });
    } catch {}
  }
}
