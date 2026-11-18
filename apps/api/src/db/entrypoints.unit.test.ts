import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const fixture=fileURLToPath(new URL('../../../../scripts/qa-db-entrypoint-fixture.mjs',import.meta.url))
for(const scenario of ['migration-new','migration-legacy-checksum','migration-checksum-mismatch','migration-rollback','admin-absent','admin-new','admin-rollback','seed-new','seed-rollback','seed-production','e2e-workspace-absent','e2e-forbidden','pool-tls'])test('CLI QA aislado: '+scenario,{timeout:25000},()=>{
 // Inherit the same TS loader as this process, including the platform-specific
 // tsx registration, without re-running node:test inside the fixture.
 const run=spawnSync(process.execPath,[...process.execArgv.filter(x=>x!=='--test'),fixture,scenario],{encoding:'utf8',timeout:20000,windowsHide:true})
 if(run.error)throw run.error
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr)
 assert.ok(run.stdout.includes('QA_ENTRYPOINT_OK:'+scenario),run.stdout+'\n'+run.stderr)
 if(scenario.endsWith('-rollback'))assert.match(run.stderr,/QA simulated SQL failure/)
 if(scenario==='migration-checksum-mismatch')assert.match(run.stderr,/MIGRACION MODIFICADA/)
 if(scenario==='seed-production')assert.match(run.stderr,/SEED DEMO PROHIBIDO/)
 if(scenario==='e2e-workspace-absent')assert.match(run.stderr,/Ejecuta db:seed contra novzi_test/)
 if(scenario==='admin-absent')assert.match(run.stderr,/NOVZI sin administrador/)
})
