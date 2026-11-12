import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=fileURLToPath(new URL('..',import.meta.url))
const metrics=['lines','statements','functions','branches']
export const COVERAGE_TARGET=95

function priority(name){
 if(/(?:security|auth|access|identity|password|roles|document-policy|projects\.service|AtlasEditor|SecurityPanel)/i.test(name))return 1
 if(/(?:projects|workspaces|contract|db\/|migrate|app\.ts|server\.ts)/i.test(name))return 2
 return 3
}
export function buildBacklog(summary,target=COVERAGE_TARGET){
 if(!summary||!summary.total)throw Error('coverage-summary.json no contiene el total')
 const normalize=(name)=>name.replaceAll('\\','/').replace(/^.*?(?=(?:apps|packages)\/)/,'')
 const files=Object.entries(summary).filter(([name])=>name!=='total').map(([name,stats])=>{
  const gaps=Object.fromEntries(metrics.map(metric=>{
   const entry=stats[metric]
   if(!entry||!Number.isFinite(entry.total)||!Number.isFinite(entry.covered))throw Error(`Falta ${metric} en ${name}`)
   const required=Math.ceil(entry.total*target/100)
   return [metric,{percentage:entry.total?Number((100*entry.covered/entry.total).toFixed(2)):100,
    remaining:Math.max(0,required-entry.covered),uncovered:entry.total-entry.covered,total:entry.total}]
  }))
  return {file:normalize(name),priority:priority(name),gaps,missingToTarget:Math.max(...metrics.map(m=>gaps[m].remaining)),
   failingMetrics:metrics.filter(m=>gaps[m].remaining>0)}
 }).filter(x=>x.failingMetrics.length)
 files.sort((a,b)=>a.priority-b.priority||b.missingToTarget-a.missingToTarget||a.file.localeCompare(b.file))
 const totals=Object.fromEntries(metrics.map(m=>[m,{pct:summary.total[m]?.pct??null,
  covered:summary.total[m]?.covered??null,total:summary.total[m]?.total??null,
  missingToTarget:Math.max(0,Math.ceil((summary.total[m]?.total||0)*target/100)-(summary.total[m]?.covered||0))}]))
 return {target,totals,files}
}
function main(){
 const report=resolve(root,'coverage/coverage-summary.json')
 if(!existsSync(report)){
  console.error('Falta coverage/coverage-summary.json. Ejecuta npm run test:coverage primero.')
  process.exitCode=1;return
 }
 const backlog=buildBacklog(JSON.parse(readFileSync(report,'utf8')))
 const target=backlog.target
 const header=[`# ATLAS — Backlog de cobertura (objetivo ${target} %)`,
  '',`Generado desde \`coverage/coverage-summary.json\`. No cambia los umbrales ni excluye archivos.`,
  '',`| Métrica | Actual | Cobertura adicional necesaria |`,`|---|---:|---:|`,
  ...metrics.map(m=>`| ${m} | ${backlog.totals[m].pct??'N/D'} % | ${backlog.totals[m].missingToTarget} unidades |`),
  '',`## Archivos pendientes (${backlog.files.length})`,'',
  '| Prioridad | Archivo | Líneas faltantes | Sentencias faltantes | Funciones faltantes | Ramas faltantes |',
  '|---|---|---:|---:|---:|---:|',
  ...backlog.files.map(f=>`| P${f.priority} | \`${f.file}\` | ${f.gaps.lines.remaining} | ${f.gaps.statements.remaining} | ${f.gaps.functions.remaining} | ${f.gaps.branches.remaining} |`),
  '', 'Estos números son unidades adicionales que deben ejecutarse para alcanzar el 95 %, no conteos de pruebas a escribir.',
  'Cubre escenarios reales; no ejecutes funciones sin aserciones ni excluyas lógica de negocio para maquillar las métricas.',
  'Primero valida funciones críticas y flujos API/E2E; luego completa condiciones y errores por archivo.','']
 writeFileSync(resolve(root,'coverage/QA_BACKLOG.md'),header.join('\n'))
 writeFileSync(resolve(root,'coverage/QA_BACKLOG.json'),JSON.stringify(backlog,null,2))
 console.log(`\nATLAS coverage: ${backlog.files.length} archivos con al menos una métrica por debajo de ${target}%.`)
 console.table(backlog.files.slice(0,18).map(f=>({archivo:f.file,prioridad:f.priority,
  lineas:f.gaps.lines.remaining,funciones:f.gaps.functions.remaining,ramas:f.gaps.branches.remaining})))
 console.log('Reporte: coverage/QA_BACKLOG.md y coverage/QA_BACKLOG.json')
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main()
