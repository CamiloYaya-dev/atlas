import { command, npm } from './process-utils.mjs';

const code = await command('docker', ['compose','--profile','test','up','-d','--wait','db_test']);
if (code !== 0) {
  console.error('No se pudo iniciar PostgreSQL de pruebas (puerto 5433).');
  process.exit(1);
}
const testEnv = {
  DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
  MIGRATIONS_DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
  NODE_ENV:'test',
  AUTH_MODE:'local',
  ATLAS_CSRF_SECRET:'qa-local-secret-key-atlas-integration-2026-not-production',
  ATLAS_ALLOW_DB_TESTS:'true',
};
console.log('Migrando EXCLUSIVAMENTE la base de prueba local en puerto 5433...');
const migrate = await npm(['run','db:migrate'],testEnv);
if (migrate !== 0) process.exit(migrate || 1);
console.log('Ejecutando pruebas de integración y aislamiento...');
const tests = await npm(['run','test:integration'],testEnv);
process.exitCode = tests || 0;
