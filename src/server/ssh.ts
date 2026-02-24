import { exec } from 'node:child_process';

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function sshExec(
  peerIp: string,
  command: string,
  username = 'root'
): Promise<SshExecResult> {
  return new Promise((resolve) => {
    const sshCommand = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${username}@${peerIp} ${JSON.stringify(command)}`;

    exec(sshCommand, { timeout: 15_000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        exitCode: error?.code ?? (error ? 1 : 0),
      });
    });
  });
}
