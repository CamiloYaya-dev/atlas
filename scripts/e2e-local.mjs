import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {readFileSync,rmSync} from 'node:fs'
import {resolve} from 'node:path'
import {planE2eBatches,assertBatchSelection,assertBatchRun,selectE2eBatches} from './e2e-batches.mjs'
const root=fileURLToPath(new URL('..',import.meta.url))
const env={...process.env,
 DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
 MIGRATIONS_DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
 NODE_ENV:'test',AUTH_MODE:'local',NOVZI_ALLOW_DB_TESTS:'true',
 NOVZI_CSRF_SECRET:'novzi-qa-local-csrf-for-automated-tests-only-2026',
 E2E_ADMIN_EMAIL:'qa-admin@novzi.test',E2E_ADMIN_PASSWORD:randomBytes(20).toString('base64url')+'!A',
 E2E_VIEWER_EMAIL:'qa-viewer@novzi.test',E2E_VIEWER_PASSWORD:randomBytes(20).toString('base64url')+'!B',
 E2E_EDITOR_EMAIL:'qa-editor@novzi.test',E2E_EDITOR_PASSWORD:randomBytes(20).toString('base64url')+'!C',
 NOVZI_E2E_AUTOSTART:'true', E2E_BASE_URL:'http://127.0.0.1:5175',
 NOVZI_DEV_API_PORT:'3003',NOVZI_DEV_WEB_PORT:'5175'
}
function exec(label,cmd,args){
 console.log(`\n[NOVZI QA] ${label}`)
 // On Windows, never run node.exe through cmd.exe: C:\Program Files would be split by the shell.
 const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit',env,shell:process.platform==='win32' && cmd!==process.execPath})
 if(result.status!==0)process.exit(result.status||1)
}
const cli=['node_modules/@playwright/test/cli.js','test']
const flags=process.argv.slice(2)
function list(selectors=[]){
 const r=spawnSync(process.execPath,[...cli,'--list','--reporter=json',...selectors],{cwd:root,env:{...env,NOVZI_E2E_AUTOSTART:'false'},encoding:'utf8',maxBuffer:16*1024*1024})
 if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr||'Error enumerando E2E')
 return JSON.parse(r.stdout)
}
const plan=planE2eBatches(list())
const selection=selectE2eBatches(plan,flags),batches=selection.batches
if(selection.partial)console.log('Diagnóstico PARCIAL E2E: no certifica la suite completa.')
for(const batch of batches)assertBatchSelection(batch,list(batch.selectors))
console.table(batches.map(b=>({lote:b.name,pruebas:b.ids.length,selectores:b.selectors.join(', ')})))
if(selection.list)process.exit(0)
// E2E starts its own API and frontend in a browser against the QA database only.
exec('PostgreSQL exclusivo QA (5433)','docker',['compose','--profile','test','up','-d','--wait','db_test'])
exec('Migraciones en QA','npm',['run','db:migrate'])
exec('Datos ficticios QA','npm',['run','db:seed'])
exec('Usuarios temporales QA','npm',['run','e2e:seed','-w','@novzi/api'])
// Independent Playwright invocations start/stop their own REAL servers. No
// production limits, auth, DB, CSRF or ACL configuration is changed.
const results=[]
for(const batch of batches){
 console.log(`\n[NOVZI QA] ${batch.name}: ${batch.ids.length} pruebas; servidor real independiente`)
 const reportPath=resolve(root,'test-results','e2e-batches',batch.name,'result.json')
 rmSync(reportPath,{force:true})
 const r=spawnSync(process.execPath,[...cli,...batch.selectors],{cwd:root,stdio:'inherit',env:{...env,NOVZI_E2E_BATCH:batch.name},shell:false})
 let ok=!r.error&&r.status===0
 if(ok)try{assertBatchRun(batch,JSON.parse(readFileSync(reportPath,'utf8')))}catch(error){ok=false;console.error(error.message)}
 results.push({lote:batch.name,pruebas:batch.ids.length,ok})
 if(r.error)console.error(r.error.message)
}
console.table(results)
console.log('Informes separados: test-results/e2e-batches/<lote>/html')
process.exitCode=results.every(r=>r.ok)?0:1
