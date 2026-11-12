import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const target of ['apps/api/.env', 'apps/web/.env']) {
  const absolute = resolve(target);
  if (existsSync(absolute)) {
    console.log(`[env] Ya existe ${target}; no se modifica.`);
  } else {
    const example = resolve(target + '.example');
    if (!existsSync(example)) throw new Error(`No existe ${target}.example`);
    copyFileSync(example, absolute);
    console.log(`[env] Creado ${target} desde ${target}.example`);
  }
}
const apiEnv = readFileSync(resolve('apps/api/.env'), 'utf8');
if (/^AUTH_MODE\s*=\s*demo\s*$/m.test(apiEnv)) {
  console.error('[env] AUTH_MODE=demo no corresponde a V4.2. Configura AUTH_MODE=local.');
  process.exitCode = 1;
} else {
  console.log('[env] Configuración local lista. No se sobrescribieron secretos.');
}
