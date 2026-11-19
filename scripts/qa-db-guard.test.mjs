import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDisposableQaService} from './qa-db-guard.mjs';

function valid(){
  return {services:{db_test:{
    environment:{POSTGRES_DB:'novzi_test',POSTGRES_USER:'novzi'},
    tmpfs:['/var/lib/postgresql/data'],
    ports:[{target:5432,published:'5433',host_ip:'127.0.0.1'}]
  }}};
}
test('permite recrear únicamente un PostgreSQL QA temporal y local',()=>{
  assert.equal(assertDisposableQaService(valid()),true);
});
test('bloquea una base distinta de novzi_test',()=>{
  const c=valid();c.services.db_test.environment.POSTGRES_DB='atlas';
  assert.throws(()=>assertDisposableQaService(c),/novzi_test/);
});
test('bloquea volumen persistente, incluso con tmpfs configurada',()=>{
  const c=valid();c.services.db_test.volumes=[{source:'dbdata',target:'/var/lib/postgresql/data'}];
  assert.throws(()=>assertDisposableQaService(c),/volúmenes persistentes/);
});
test('bloquea base QA sin tmpfs',()=>{
  const c=valid();delete c.services.db_test.tmpfs;
  assert.throws(()=>assertDisposableQaService(c),/tmpfs/);
});
test('bloquea exposición del servicio en otro puerto o interfaz',()=>{
  const c=valid();c.services.db_test.ports[0].host_ip='0.0.0.0';
  assert.throws(()=>assertDisposableQaService(c),/127.0.0.1:5433/);
});
test('bloquea falta del servicio db_test',()=>{
  assert.throws(()=>assertDisposableQaService({services:{db:{}}}),/db_test/);
});
