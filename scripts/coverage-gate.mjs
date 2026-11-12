import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const report=resolve(root,'coverage/coverage-summary.json')
const TARGET=95
const METRICS=['lines','statements','functions','branches']
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
  const metric=data?.[kind],pct=metric?.pct
  if(typeof pct!=='number'||!Number.isFinite(pct)||pct<TARGET){
   console.error(`NO PASA ${label}: ${kind} ${typeof pct==='number'?pct.toFixed(2)+'%':'sin medir'} < ${TARGET}%`)
   errors++
  }
 }
}
console.log(`ATLAS coverage | objetivo: >=${TARGET}% en líneas, sentencias, funciones y ramas, GLOBAL y POR ARCHIVO`)
validate('TOTAL',summary.total)
for(const [name,data] of files)validate(name.replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/', ''),data)
if(errors){
 console.error(`\nCobertura insuficiente: ${errors} verificaciones no aprobadas.`)
 console.error('Abre coverage/index.html para priorizar los archivos faltantes. No alteres las exclusiones para esconder código.')
 process.exit(1)
}
console.log(`Cobertura validada: todos los archivos reportados cumplen >=${TARGET}% en las 4 métricas.`)
