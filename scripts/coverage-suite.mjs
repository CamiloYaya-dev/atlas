import {spawnSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {auditCoverageTransforms} from './coverage-transform-audit.mjs'
const root=fileURLToPath(new URL('..',import.meta.url))

/** Collect independent phases for diagnostics even if a test fails. Never certify partial coverage. */
export function runCoveragePhases(mode,run,log=console){
 if(!['unit','full'].includes(mode))throw new Error('Uso: coverage-suite.mjs unit|full')
 const phases=[['unit',['scripts/run-tests.mjs','unit']]]
 if(mode==='full')phases.push(['integration',['scripts/run-tests.mjs','integration']],['operational',['scripts/coverage-operational.mjs']])
 const failed=[]
 for(const [kind,args] of phases){
  log.log(`\n[ATLAS COVERAGE] Fase ${kind}: ejecución bajo un mismo recolector V8`)
  try{
   const result=run(args)
   if(result.error)throw result.error
   if(result.status!==0){failed.push(kind);log.error(`[ATLAS COVERAGE] Fase ${kind} falló (estado ${result.status}, señal ${result.signal||'ninguna'}). Conserva el primer error.`)}
  }catch(error){failed.push(kind);log.error(`[ATLAS COVERAGE] Fase ${kind}: ${error.message||error}`)}
 }
 if(failed.length)log.error(`[ATLAS COVERAGE] Fases fallidas: ${failed.join(', ')}. Medición PARCIAL de diagnóstico, NO certificable; no consolidar ni comparar con 90%.`)
 return failed.length?1:0
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 process.exitCode=runCoveragePhases(process.argv[2],args=>spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env,shell:false}))
 if(!process.exitCode&&process.env.ATLAS_QA_COVERAGE_TS==='1'){
  const result=auditCoverageTransforms(process.env.NODE_V8_COVERAGE,root)
  console.log('[ATLAS COVERAGE] Mapas fuente consistentes:',result)
 }
}
