import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

mkdirSync('backups', { recursive: true });
const file = join('backups', `atlas-local-${new Date().toISOString().replaceAll(':','-')}.dump`);
console.log(`Generando copia local: ${file}`);
const proc = spawn('docker', ['compose','exec','-T','db','pg_dump','-U','atlas','-d','atlas','-Fc'], { stdio: ['ignore','pipe','inherit'] });
const dest = createWriteStream(file);
proc.stdout.pipe(dest);
const code = await new Promise((resolve, reject) => {
  proc.on('error', reject);
  dest.on('error', reject);
  proc.on('close', resolve);
}).catch((err) => { console.error(err.message); return 1; });
await new Promise(resolve => dest.end(resolve));
if (code !== 0) {
  rmSync(file, { force: true });
  console.error('Backup fallido; se eliminó el archivo incompleto.');
  process.exitCode = 1;
} else {
  const hash=createHash('sha256');
  for await(const block of createReadStream(file))hash.update(block);
  const digest=hash.digest('hex');
  writeFileSync(file+'.sha256',digest+'  '+file+'\n');
  console.log(`Backup generado: ${file} (SHA-256 verificado mediante .sha256)`);
}
