import { spawn } from 'node:child_process';

export function command(bin, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...extraEnv },
    });
    p.once('error', reject);
    p.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
export function npm(args, env = {}) {
  return command('npm', args, env);
}
