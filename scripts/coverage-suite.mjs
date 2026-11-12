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

if(mode==='full'){
 // Conserva la instrumentación V8 en procesos de configuración, scripts y servidor.
 // Ningún caso apunta a los datos del usuario: está restringido a atlas_test.
 console.log('\n[ATLAS COVERAGE] Entrypoints operacionales sobre base QA exclusiva')
 const result=spawnSync(process.execPath,['scripts/coverage-operational.mjs'],{cwd:root,stdio:'inherit',env:process.env,shell:false})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status||1)
}
