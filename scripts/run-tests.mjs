import {readdir,stat,mkdir,writeFile,rm} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {resolve,relative} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {parseTap} from './qa-test-summary.mjs'
const root=resolve(import.meta.dirname,'..')
const tsx=resolve(root,'node_modules','tsx','dist','cli.mjs')
const mode=process.argv[2]||'unit',coverage=process.argv.includes('--coverage'),verbose=process.argv.includes('--verbose')
if(!['unit','integration'].includes(mode))throw Error('Uso: node scripts/run-tests.mjs unit|integration [--coverage] [--verbose]')
if(!existsSync(tsx)){console.error('Faltan node_modules: ejecuta npm install');process.exit(1)}
async function walk(dir){const out=[];for(const name of await readdir(dir)){const f=resolve(dir,name);if((await stat(f)).isDirectory())out.push(...await walk(f));else out.push(f)}return out}
let files=[]
if(mode==='unit'){
 for(const dir of ['apps/api/src','apps/web/src','packages/contracts/src']){
  files.push(...(await walk(resolve(root,dir))).filter(f=>f.endsWith('.unit.test.ts')||f.replaceAll('\\','/').endsWith('/domain/document.test.ts')||f.replaceAll('\\','/').endsWith('/domain/access-policy.test.ts')))
 }
}else{
 const url=process.env.DATABASE_URL||''
 if(process.env.NODE_ENV!=='test'||process.env.NOVZI_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/novzi_test(?:\?|$)/.test(url)){
  console.error('INTEGRACIÓN BLOQUEADA: requiere PostgreSQL LOCAL QA, puerto 5433 y nombre novzi_test. Usa npm run test:db');process.exit(1)
 }
 files=[resolve(root,'apps/api/src/tests/integration.test.ts'),resolve(root,'apps/api/src/tests/api.integration.test.ts'),resolve(root,'apps/api/src/tests/uml-scoped.integration.test.ts')]
}
files.sort()
const reportDir=resolve(root,'test-results','qa')
await mkdir(reportDir,{recursive:true})
// Evitar interpretar un resumen de una ejecución anterior como si fuese actual.
await Promise.all(['summary.json','summary.txt','.log'].map(suffix=>rm(resolve(reportDir,`${mode}${suffix.startsWith('.')?suffix:'-'+suffix}`),{force:true})))
console.log(`[NOVZI QA] ${mode}: ${files.length} archivos de pruebas`)
const safeEnv={...process.env,NODE_ENV:'test',AUTH_MODE:'local',NOVZI_CSRF_SECRET:process.env.NOVZI_CSRF_SECRET||'qa-secret-local-only-for-unit-tests-2026-01',DATABASE_URL:process.env.DATABASE_URL||'postgresql://novzi:novzi_test_only@127.0.0.1:5433/novzi_test'}
const results=[],logChunks=[]
for(const file of files){
 const loader=pathToFileURL(resolve(root,'scripts/coverage-ts-register.mjs')).href
 const args=[...(process.env.NOVZI_QA_COVERAGE_TS==='1'?['--enable-source-maps','--import',loader]:[tsx]),'--test',...(coverage?['--experimental-test-coverage']:[]),file]
 const name=relative(root,file).replaceAll('\\','/')
 const started=Date.now()
 const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,env:safeEnv,windowsHide:false})
 const code=run.error?1:(run.status===null?1:run.status)
 const output=[run.stdout||'',run.stderr||'',run.error?String(run.error):''].filter(Boolean).join('\n')
 logChunks.push(`\n========== ${name} ==========\n${output}`)
 const parsed=parseTap(output,code)
 const entry={file:name,elapsedMs:Date.now()-started,...parsed}
 results.push(entry)
 const ok=code===0&&parsed.fail===0
 console.log(`${ok?'✓':'✖'} ${name}: ${parsed.pass}/${parsed.tests} aprobadas${parsed.fail?`, ${parsed.fail} fallidas`:''} (${(entry.elapsedMs/1000).toFixed(1)}s)`)
 if(!ok){for(const failure of parsed.failures)console.error(`    ✖ ${failure.name}${failure.location?' | '+failure.location:''}${failure.message?'\n      '+failure.message:''}`)}
 if(verbose)process.stdout.write(output+'\n')
}
const sum=key=>results.reduce((value,item)=>value+item[key],0)
const failed=results.filter(x=>x.exitCode!==0||x.fail>0)
const totals={files:results.length,filesPassed:results.length-failed.length,filesFailed:failed.length,tests:sum('tests'),passed:sum('pass'),failed:sum('fail'),skipped:sum('skipped'),cancelled:sum('cancelled'),todo:sum('todo')}
const lines=[`NOVZI QA ${mode.toUpperCase()} — RESUMEN FINAL`,`Archivos: ${totals.filesPassed} aprobados / ${totals.filesFailed} fallidos / ${totals.files} ejecutados`,`Pruebas: ${totals.passed} aprobadas / ${totals.failed} fallidas / ${totals.tests} ejecutadas`,`Omitidas: ${totals.skipped} | Canceladas: ${totals.cancelled} | Pendientes: ${totals.todo}`]
// Node TAP contabiliza el caso fallido y su test contenedor por separado.
// Mostrar los totales oficiales, pero distinguir el número real de casos accionables.
const concreteFailures=results.reduce((n,file)=>n+file.failures.length,0)
if(totals.failed>concreteFailures)lines.push(`Casos con error concreto: ${concreteFailures} (${totals.failed-concreteFailures} fallo(s) adicionales de agrupadores TAP)`)
if(failed.length){lines.push('','PRUEBAS FALLIDAS:');for(const file of failed){lines.push(`- ${file.file}`);for(const failure of file.failures)lines.push(`  * ${failure.name}${failure.location?' ('+failure.location+')':''}${failure.message?' — '+failure.message:''}`)}}else lines.push('Todas las pruebas finalizaron correctamente.')
const summary=lines.join('\n')+'\n'
await Promise.all([
 writeFile(resolve(reportDir,`${mode}-summary.json`),JSON.stringify({generatedAt:new Date().toISOString(),mode,totals,results},null,2),'utf8'),
 writeFile(resolve(reportDir,`${mode}-summary.txt`),summary,'utf8'),
 writeFile(resolve(reportDir,`${mode}.log`),logChunks.join('\n'),'utf8')
])
console.log('\n'+summary)
console.log(`[NOVZI QA] Informes: test-results/qa/${mode}-summary.txt, ${mode}-summary.json y ${mode}.log`)
process.exitCode=failed.length?1:0
