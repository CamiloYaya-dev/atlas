import readline from 'node:readline';
import { npm } from './process-utils.mjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
const email = (await ask('Correo del administrador: ')).trim().toLowerCase();
const name = (await ask('Nombre [Administrador ATLAS]: ')).trim() || 'Administrador ATLAS';
rl.close();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Correo no válido.');
  process.exit(1);
}

async function hiddenQuestion(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Abre una terminal interactiva para escribir la contraseña sin mostrarla.');
  }
  process.stdout.write(prompt);
  const input = process.stdin;
  const originalRaw = input.isRaw;
  let value = '';
  return await new Promise((resolve, reject) => {
    function cleanup() {
      input.off('data', handle);
      input.setRawMode(originalRaw ?? false);
      input.pause();
    }
    function handle(chunk) {
      const chars = chunk.toString('utf8');
      for (const char of chars) {
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Operación cancelada'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char !== '\u007f' && char !== '\u001b') {
          value += char;
          process.stdout.write('*');
        }
      }
    }
    input.setRawMode(true);
    input.resume();
    input.on('data', handle);
  });
}

try {
  const password = await hiddenQuestion('Contraseña segura (mínimo 12 caracteres): ');
  const confirm = await hiddenQuestion('Confirmar contraseña: ');
  if (password.length < 12 || password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
  const code = await npm(['run', 'admin:create'], {
    ATLAS_ADMIN_EMAIL: email,
    ATLAS_ADMIN_NAME: name,
    ATLAS_BOOTSTRAP_PASSWORD: password,
  });
  if (code !== 0) process.exitCode = code || 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
