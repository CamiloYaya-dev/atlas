import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const report=resolve(root,'coverage/coverage-summary.json')
import {COVERAGE_TARGET as TARGET,COVERAGE_METRICS as METRICS,coveragePercent} from './coverage-target.mjs'
if(!existsSync(report)){
 console.error('No existe el reporte agregado. Ejecuta npm run test:coverage primero.')
 process.exit(1)
}
const summary=JSON.parse(readFileSync(report,'utf8'))
const files=Object.entries(summary).filter(([name])=>name!=='total')
const measuredPaths=files.map(([name])=>name.replaceAll('\\','/'))
if(!files.length){console.error('El reporte no contiene archivos fuente. Coverage NO verificado.');process.exit(1)}
let errors=0
// Require every runtime source file to appear in coverage (0% counts). Checking only
// the global percentage allows silently omitting a large feature entirely.
function visit(directory,relative){
 if(!existsSync(directory))return
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const sub=resolve(directory,entry.name),name=`${relative}/${entry.name}`
  if(entry.isDirectory()){visit(sub,name);continue}
  if(name.startsWith('apps/web/src/test/')||name==='apps/web/src/features/security/types.ts')continue
  if(!/\.(ts|tsx)$/.test(entry.name)||/\.d\.ts$|\.(unit\.|integration\.|browser\.)?test\.ts(x)?$/.test(entry.name))continue
  if(!measuredPaths.some(path=>path===name||path.endsWith('/'+name))){
   console.error(`SIN MEDIR: ${name}`);errors++
  }
 }
}
for(const area of ['apps/api/src','apps/web/src','packages/contracts/src','packages/fixtures/src'])visit(resolve(root,area),area)

for(const area of ['apps/api/src/','apps/web/src/','packages/']){
 if(!files.some(([name])=>name.replaceAll('\\','/').includes(area))){
  console.error(`FALTA cobertura instrumentada para ${area}; no se puede aprobar la puerta de calidad.`)
  errors++
 }
}
function validate(label,data){
 for(const kind of METRICS){
  const metric=data?.[kind],pct=coveragePercent(metric)
  if(pct===null||pct<TARGET){
   console.error(`NO PASA ${label}: ${kind} ${typeof pct==='number'?pct.toFixed(2)+'%':'sin medir'} < ${TARGET}%`)
   errors++
  }
 }
}
console.log(`NOVZI coverage | objetivo: >=${TARGET}% en líneas, sentencias, funciones y ramas, GLOBAL y POR ARCHIVO`)
// Check each layer independently, from the original instrumented counts.
for(const area of ['apps/api/src/','apps/web/src/','packages/contracts/src/','packages/fixtures/src/']){
 const entries=files.filter(([name])=>name.replaceAll('\\','/').includes(area))
 if(!entries.length){console.error(`SIN MEDIR: ${area}`);errors++;continue}
 const metrics=Object.fromEntries(METRICS.map(kind=>[kind,{
  total:entries.reduce((a,[,data])=>a+(data[kind]?.total??NaN),0),
  covered:entries.reduce((a,[,data])=>a+(data[kind]?.covered??NaN),0)
 }]))
 if(!metrics.lines.total){console.error(`SIN CÓDIGO MEDIDO: ${area}`);errors++}
 console.log(`${area}: ${METRICS.map(kind=>`${kind} ${coveragePercent(metrics[kind])?.toFixed(2)??'N/D'}%`).join(' | ')}`)
 validate(area,metrics)
}
if(!summary.total?.lines?.total){console.error('Sin líneas instrumentadas en el total');errors++}
validate('TOTAL',summary.total)
for(const [name,data] of files)validate(name.replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/', ''),data)
if(errors){
 console.error(`\nCobertura insuficiente: ${errors} verificaciones no aprobadas.`)
 console.error('Abre coverage/index.html para priorizar los archivos faltantes. No alteres las exclusiones para esconder código.')
 process.exit(1)
}
console.log(`Cobertura validada: todos los archivos reportados cumplen >=${TARGET}% en las 4 métricas.`)
