import { npm } from './process-utils.mjs';

const status = await npm(['run', 'admin:status']);
if (status === 0) {
  console.log('[admin] Ya existe un administrador.');
} else if (status === 2) {
  console.log('[admin] Falta crear el administrador inicial.');
  const code = await npm(['run', 'admin:setup']);
  if (code !== 0) process.exitCode = code || 1;
} else {
  console.error('[admin] No fue posible verificar administradores. Revisa la base de datos.');
  process.exitCode = status || 1;
}
