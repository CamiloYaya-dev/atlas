import {readdir,stat} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,relative} from 'node:path'
import {spawnSync} from 'node:child_process'
const root=resolve(import.meta.dirname,'..')
const tsx=resolve(root,'node_modules','tsx','dist','cli.mjs')
const mode=process.argv[2]||'unit',coverage=process.argv.includes('--coverage')
if(!['unit','integration'].includes(mode))throw Error('Uso: node scripts/run-tests.mjs unit|integration [--coverage]')
if(!existsSync(tsx)){console.error('Faltan node_modules: ejecuta npm install');process.exit(1)}
async function walk(dir){const out=[];for(const name of await readdir(dir)){const f=resolve(dir,name);if((await stat(f)).isDirectory())out.push(...await walk(f));else out.push(f)}return out}
let files=[]
if(mode==='unit'){
 for(const dir of ['apps/api/src','apps/web/src','packages/contracts/src']){
  files.push(...(await walk(resolve(root,dir))).filter(f=>f.endsWith('.unit.test.ts')||f.replaceAll('\\','/').endsWith('/domain/document.test.ts')||f.replaceAll('\\','/').endsWith('/domain/access-policy.test.ts')))
 }
}else{
 const url=process.env.DATABASE_URL||''
 if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/atlas_test(?:\?|$)/.test(url)){
  console.error('INTEGRACIÓN BLOQUEADA: requiere PostgreSQL LOCAL QA, puerto 5433 y nombre atlas_test. Usa npm run test:db');process.exit(1)
 }
 files=[resolve(root,'apps/api/src/tests/integration.test.ts'),resolve(root,'apps/api/src/tests/api.integration.test.ts')]
}
files.sort()
console.log(`[ATLAS QA] ${mode}: ${files.length} archivos de pruebas`)
const safeEnv={...process.env,NODE_ENV:'test',AUTH_MODE:'local',ATLAS_CSRF_SECRET:process.env.ATLAS_CSRF_SECRET||'qa-secret-local-only-for-unit-tests-2026-01',DATABASE_URL:process.env.DATABASE_URL||'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test'}
let failed=false
for(const file of files){
 const args=[tsx,'--test',...(coverage?['--experimental-test-coverage']:[]),file]
 console.log(`\n[ATLAS QA] ${relative(root,file)}`)
 const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:safeEnv,windowsHide:false})
 if(run.status!==0){failed=true;console.error(`[FALLÓ] ${relative(root,file)}`)}
}
process.exitCode=failed?1:0
