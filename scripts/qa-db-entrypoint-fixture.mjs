// Isolated process for exercising the production CLI entrypoints through a strict
// simulated PostgreSQL boundary. Never connect to any server or modify real data.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const require=createRequire(import.meta.url),pg=require('pg')
const scenario=process.argv[2],sqlText='SELECT 1;'
const seen=[],result=(rows=[])=>({rows,rowCount:rows.length})
const invalid=new Error('QA simulated SQL failure')
// Reset all variables used by the tested scripts. The database is a synthetic QA address;
// the pool prototype is replaced before any production module is loaded.
Object.assign(process.env,{NODE_ENV:'test',AUTH_MODE:'local',DATABASE_URL:'postgresql://qa:qa@127.0.0.1:5433/novzi_test',NOVZI_ALLOW_DB_TESTS:'true',NOVZI_CSRF_SECRET:'coverage-qa-only-32-characters-2026',NOVZI_EXPORT_SIGNING_KEY:'coverage-qa-only-32-characters-2026',DB_SSL:'false',MIGRATIONS_DATABASE_URL:'',NOVZI_ADMIN_EMAIL:'entrypoint@novzi.test',NOVZI_BOOTSTRAP_PASSWORD:'QA-Entrypoint-Only-2026!',NOVZI_ADMIN_NAME:'QA',E2E_ADMIN_EMAIL:'admin@novzi.test',E2E_ADMIN_PASSWORD:'QA-Entrypoint-Only-2026!',E2E_VIEWER_EMAIL:'viewer@novzi.test',E2E_VIEWER_PASSWORD:'QA-Entrypoint-Only-2026!',E2E_EDITOR_EMAIL:'editor@novzi.test',E2E_EDITOR_PASSWORD:'QA-Entrypoint-Only-2026!'})
const originalCwd=process.cwd()
let target,expected=0,directory
if(scenario.startsWith('migration-')){
 directory=mkdtempSync(join(tmpdir(),'novzi-qa-migration-'));mkdirSync(join(directory,'migrations'));writeFileSync(join(directory,'migrations','001_qa.sql'),sqlText);writeFileSync(join(directory,'migrations','README.txt'),'ignored');process.chdir(directory);target='migrate'
 if(['migration-checksum-mismatch','migration-rollback'].includes(scenario))expected=1
}else if(scenario.startsWith('admin-')){target=scenario==='admin-absent'?'admin-status':'create-admin';expected=scenario==='admin-absent'?2:scenario==='admin-rollback'?1:0}
else if(scenario.startsWith('seed-')){target='seed';if(scenario==='seed-production'){expected=1;Object.assign(process.env,{NODE_ENV:'production',DATABASE_URL:'postgresql://qa:qa@db.example.invalid/novzi_test',CORS_ORIGINS:'https://novzi.example.invalid',DB_SSL:'true'})}else if(scenario==='seed-rollback')expected=1}
else if(scenario==='e2e-workspace-absent'||scenario==='e2e-forbidden'){target='e2e-seed';expected=1;if(scenario==='e2e-forbidden')process.env.NOVZI_ALLOW_DB_TESTS='false'}
else if(scenario==='pool-tls'){target='pool';process.env.DB_SSL='true'}
else throw Error('Escenario QA desconocido '+scenario)
async function query(sql,params=[]){
 seen.push(sql.trim());
 if(scenario==='admin-absent'&&sql.includes('SELECT count(*)'))return result([{n:'0'}])
 if(scenario.startsWith('admin-')){
  if(sql.includes('SELECT count(*)'))return result([{count:'0'}]);if(sql.includes('INSERT INTO novzi_users')){assert.equal(params[1],'entrypoint@novzi.test');assert.match(params[3],/^scrypt\$/);if(scenario==='admin-rollback')throw invalid;return result([{id:params[0]}])}
 }
 if(scenario.startsWith('migration-')){
  if(sql.includes('pg_advisory_')||sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations')||sql.includes('ALTER TABLE schema_migrations'))return result()
  if(sql.includes('SELECT checksum FROM schema_migrations')){if(scenario==='migration-checksum-mismatch')return result([{checksum:'changed'}]);if(scenario==='migration-legacy-checksum')return result([{checksum:null}]);return result()}
  if(sql===sqlText){if(scenario==='migration-rollback')throw invalid;return result()}
  if(sql.includes('INSERT INTO schema_migrations')||sql.includes('UPDATE schema_migrations SET checksum')){assert.deepEqual(params,['001_qa.sql',createHash('sha256').update(sqlText).digest('hex')]);return result()}
 }
 if(scenario.startsWith('seed-')){
  if(sql.includes('SELECT id FROM workspaces'))return result();if(sql.includes('INSERT INTO workspaces'))return result([{id:'w-qa'}]);if(sql.includes('INSERT INTO workspace_roles'))return result([{id:'r-qa'}]);if(sql.includes('INSERT INTO role_permissions'))return result();if(sql.includes('SELECT id FROM workspace_roles'))return result([{id:'owner-qa'}]);if(sql.includes('INSERT INTO workspace_members'))return result();if(sql.includes('SELECT id FROM projects'))return result();if(sql.includes('INSERT INTO projects'))return result([{id:'p-qa'}]);if(sql.includes('INSERT INTO project_documents')){if(scenario==='seed-rollback')throw invalid;assert.equal(params[0],'p-qa');assert.ok(JSON.parse(params[1]).diagrams.length);return result()};if(sql.includes('INSERT INTO project_document_versions'))return result()
 }
 if(scenario==='e2e-workspace-absent'){
  if(sql.includes('INSERT INTO novzi_users'))return result([{id:'qa-user'}]);if(sql.includes('SELECT id FROM workspaces'))return result()
 }
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql.trim()))return result()
 throw Error('SQL inesperado QA: '+sql)
}
pg.Pool.prototype.query=query
pg.Pool.prototype.connect=async()=>{seen.push('CONNECT');return {query,release:()=>seen.push('RELEASE')}}
pg.Pool.prototype.end=async()=>{seen.push('END')}
// No real sockets can be opened. A broken expectation must fail even when the
// CLI catches its own exceptions and converts them to an exit status.
try{
 const imported=await import(new URL(`../apps/api/src/db/${target}.ts`,import.meta.url))
 if(scenario==='pool-tls'){assert.deepEqual(imported.pool.options.ssl,{rejectUnauthorized:true});assert.equal(seen.length,0)}
}catch(error){if(scenario!=='e2e-forbidden')throw error;assert.match(String(error),/E2E seed bloqueado/);process.exitCode=1}
process.once('beforeExit',()=>{
 try{
  assert.equal(process.exitCode??0,expected)
  if(['seed-production','e2e-forbidden','pool-tls'].includes(scenario))assert.deepEqual(seen,[])
  else if(scenario==='admin-absent'){assert.ok(seen.some(s=>s.includes('SELECT count(*)')));assert.ok(seen.includes('END'))}
  else if(scenario==='migration-checksum-mismatch'){assert.ok(!seen.includes('BEGIN'));assert.ok(seen.some(s=>s.includes('pg_advisory_unlock')));assert.ok(seen.includes('RELEASE'))}
  else if(scenario==='migration-legacy-checksum'){assert.ok(seen.some(s=>s.includes('UPDATE schema_migrations SET checksum')));assert.ok(!seen.includes('BEGIN'));assert.ok(seen.includes('RELEASE'))}
  else if(expected===1){assert.ok(seen.includes('ROLLBACK'));assert.ok(!seen.includes('COMMIT'));assert.ok(seen.includes('RELEASE'))}
  else{assert.ok(seen.includes('BEGIN'));assert.ok(seen.includes('COMMIT'));assert.ok(!seen.includes('ROLLBACK'));assert.ok(seen.includes('RELEASE'));assert.ok(seen.includes('END'))}
  if(scenario==='migration-new')assert.ok(seen.includes(sqlText))
  if(scenario==='seed-new'){assert.ok(seen.some(s=>s.includes('INSERT INTO workspaces')));assert.ok(seen.some(s=>s.includes('INSERT INTO project_document_versions')))}
  console.log('QA_ENTRYPOINT_OK:'+scenario);process.exitCode=0
 }finally{if(directory){process.chdir(originalCwd);rmSync(directory,{recursive:true,force:true})}}
})
