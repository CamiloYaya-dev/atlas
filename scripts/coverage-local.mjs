import {existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const mode=process.argv[2]||'unit'
if(!['unit','full'].includes(mode))throw new Error('Uso: coverage-local.mjs unit|full')
const qaUrl='postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test'
const env={...process.env,NODE_ENV:'test',AUTH_MODE:'local',DATABASE_URL:qaUrl,
 MIGRATIONS_DATABASE_URL:qaUrl,DB_SSL:'false',ATLAS_ALLOW_DB_TESTS:'true',
 ATLAS_CSRF_SECRET:'atlas-local-qa-coverage-only-2026-not-production'}
function exec(label,bin,args){
 console.log(`\n[ATLAS COVERAGE] ${label}`)
 // Windows requires a shell for npm.cmd, but an absolute node.exe path MUST NOT
 // pass through cmd.exe ("C:\\Program Files" would otherwise be split).
 const result=spawnSync(bin,args,{cwd:root,stdio:'inherit',env,
  shell:process.platform==='win32'&&bin!==process.execPath})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status||1)
}
if(mode==='full'){
 // CI already starts its own PostgreSQL service on port 5433; do not
 // attempt to bind a second Docker container to that port.
 if(process.env.ATLAS_COVERAGE_USE_EXISTING_DB!=='true')
  exec('Iniciar exclusivamente PostgreSQL QA, puerto 5433','docker',['compose','--profile','test','up','-d','--wait','db_test'])
 exec('Aplicar migraciones exclusivamente en atlas_test','npm',['run','db:migrate'])
}
const c8=resolve(root,'node_modules','c8','bin','c8.js')
if(!existsSync(c8)){
 console.error('Falta c8. Ejecuta npm install en la raíz y vuelve a intentar.')
 process.exit(1)
}
exec(`Medir cobertura AGREGADA de ${mode==='full'?'unitarias + integración':'unitarias'}`,
 process.execPath,[c8,process.execPath,'scripts/coverage-suite.mjs',mode])
console.log('\n[ATLAS COVERAGE] Reportes generados en coverage/index.html, coverage/lcov.info y coverage/coverage-summary.json')
console.log('[ATLAS COVERAGE] Para aplicar umbral por archivo de 95%: npm run coverage:check')
