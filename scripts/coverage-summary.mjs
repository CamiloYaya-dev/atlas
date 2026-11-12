import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const file=resolve(root,'coverage/coverage-summary.json')
if(!existsSync(file)){console.error('No existe cobertura. Ejecuta npm run test:coverage primero.');process.exit(1)}
const result=JSON.parse(readFileSync(file,'utf8'))
const metrics=['lines','statements','functions','branches']
const entries=Object.entries(result).filter(([key])=>key!=='total')
console.log('ATLAS — Coverage real (porcentaje de código ejecutado, NO de pruebas aprobadas)')
console.log('Área'.padEnd(18)+metrics.map(m=>m.padStart(14)).join(''))
for(const area of ['TOTAL','API','WEB','PACKAGES']){
 const matches=area==='TOTAL'?entries:entries.filter(([name])=>{
  const path=name.replaceAll('\\','/')
  return path.includes(area==='API'?'apps/api/src/':area==='WEB'?'apps/web/src/':'packages/')
 })
 const row=metrics.map(metric=>{
  const covered=matches.reduce((sum,[,s])=>sum+(s?.[metric]?.covered||0),0)
  const total=matches.reduce((sum,[,s])=>sum+(s?.[metric]?.total||0),0)
  return total?`${(covered/total*100).toFixed(2)}%`:'SIN DATOS'
 })
 console.log(area.padEnd(18)+row.map(x=>x.padStart(14)).join(''))
}
console.log(`\nArchivos incluidos: ${entries.length}. Detalle: coverage/index.html`)
