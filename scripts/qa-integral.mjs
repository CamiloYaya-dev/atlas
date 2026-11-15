import {spawnSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const root=fileURLToPath(new URL('..',import.meta.url))
// The browser gate is independent of code coverage. A failure in one does not
// prevent collecting the other diagnostics; neither can compensate for the other.
export const phases=[['Herramientas QA','test:qa-tools'],['TypeScript','typecheck'],['Grafo','test:graph'],['Exportaciones','test:advanced-export'],['Cobertura completa API/Web','test:coverage'],['Umbral por capa y archivo','coverage:check'],['E2E navegador real','test:e2e:local'],['Build','build']]
export function runIntegral(run,log=console){
 const results=[];let coverageValid=false
 for(const [label,command] of phases){
  if(command==='coverage:check'&&!coverageValid){results.push({label,command,ok:false});log.error('Gate de cobertura bloqueado: ejecución incompleta');continue}
  let ok=false
  try{const r=run(command);ok=!r.error&&r.status===0;if(r.error)log.error(r.error.message)}catch(error){log.error(String(error))}
  if(command==='test:coverage')coverageValid=ok
  results.push({label,command,ok})
 }
 log.table(results);return results.every(r=>r.ok)?0:1
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 process.exitCode=runIntegral(command=>spawnSync('npm',['run',command],{cwd:root,stdio:'inherit',shell:process.platform==='win32'}))
}
