/**
 * Bloqueo preventivo para operaciones que destruyen exclusivamente datos
 * temporales de QA. No acepta configuraciones de PostgreSQL persistentes.
 */
export function assertDisposableQaService(compose) {
  const qa = compose?.services?.db_test;
  if (!qa) throw new Error('La configuración Docker no contiene el servicio db_test');

  const name = qa.environment?.POSTGRES_DB;
  const user = qa.environment?.POSTGRES_USER;
  if (name !== 'novzi_test' || user !== 'novzi') {
    throw new Error('db_test debe declarar POSTGRES_DB=novzi_test y POSTGRES_USER=novzi');
  }

  const hasTmpfs = Array.isArray(qa.tmpfs) && qa.tmpfs.some(entry =>
    typeof entry === 'string'
      ? entry.split(':')[0] === '/var/lib/postgresql/data'
      : entry?.target === '/var/lib/postgresql/data'
  );
  if (!hasTmpfs || (Array.isArray(qa.volumes) && qa.volumes.length > 0)) {
    throw new Error('db_test debe almacenar PostgreSQL en tmpfs y no tener volúmenes persistentes');
  }

  const hasPort = Array.isArray(qa.ports) && qa.ports.some(port =>
    Number(port.target) === 5432 && String(port.published) === '5433' &&
    port.host_ip === '127.0.0.1'
  );
  if (!hasPort || qa.network_mode === 'host') {
    throw new Error('db_test debe publicar únicamente PostgreSQL en 127.0.0.1:5433');
  }
  return true;
}
