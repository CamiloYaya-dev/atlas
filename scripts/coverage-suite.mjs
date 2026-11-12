import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const mode=process.argv[2]
if(!['unit','full'].includes(mode))throw new Error('Uso: coverage-suite.mjs unit|full')
for(const kind of mode==='full'?['unit','integration']:['unit']){
 console.log(`\n[ATLAS COVERAGE] Ejecutando ${kind} bajo un mismo recolector V8`)
 const result=spawnSync(process.execPath,['scripts/run-tests.mjs',kind],{cwd:root,stdio:'inherit',env:process.env,shell:false})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status||1)
}
