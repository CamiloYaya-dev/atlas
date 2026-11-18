import {COVERAGE_TARGET,coveragePercent} from './coverage-target.mjs'
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const output=resolve(root,'coverage')
const sources=[['Backend + contratos',resolve(output,'backend')],['Frontend React',resolve(output,'frontend')]]
const metrics=['lines','statements','functions','branches']
const combined={}
const paths=[]
let error=false
for(const [label,folder] of sources){
 const summary=join(folder,'coverage-summary.json')
 if(!existsSync(summary)){
  console.error(`[coverage] FALTA reporte ${label}: ${summary}`)
  error=true;continue
 }
 const rows=JSON.parse(readFileSync(summary,'utf8'))
 for(const [key,entry] of Object.entries(rows)){
  if(key==='total')continue
  const raw=key.replaceAll('\\','/')
  const marker=raw.match(/(?:^|\/)(apps\/(?:api|web)\/src\/|packages\/[^/]+\/src\/)/)
  const normalized=marker?raw.slice(raw.indexOf(marker[1])):label==='Frontend React'&&raw.startsWith('src/')?'apps/web/'+raw:raw
  // Different collectors MUST NOT silently count the same source file twice.
  const prior=Object.keys(combined).find(p=>p.endsWith(normalized)||normalized.endsWith(p))
  if(prior){console.error(`[coverage] ARCHIVO DUPLICADO entre recolectores: ${prior} / ${normalized}`);error=true;continue}
  combined[normalized]=entry
 }
 const lcov=join(folder,'lcov.info')
 if(existsSync(lcov)){
  const normalized=readFileSync(lcov,'utf8').replaceAll('\\','/').split('\n').map(line=>{
   if(!line.startsWith('SF:'))return line
   let path=line.slice(3)
   const marker=path.match(/(?:^|\/)(apps\/(?:api|web)\/src\/|packages\/[^/]+\/src\/)/)
   if(marker)path=path.slice(path.indexOf(marker[1]))
   else if(label==='Frontend React'&&path.startsWith('src/'))path='apps/web/'+path
   return 'SF:'+path
  }).join('\n')
  paths.push(normalized.trim())
 }
}
if(error)process.exit(1)
const total={}
for(const metric of metrics){
 let count=0, covered=0, skipped=0
 for(const entry of Object.values(combined)){
  const m=entry[metric]
  if(!m||typeof m.total!=='number'||typeof m.covered!=='number')throw Error(`Métrica faltante: ${metric}`)
  count+=m.total;covered+=m.covered;skipped+=m.skipped||0
 }
 total[metric]={total:count,covered,skipped,pct:count?Math.round(10000*covered/count)/100:100}
}
const scopes=[['API','apps/api/src/'],['Web','apps/web/src/'],['Contratos','packages/contracts/src/'],['Fixtures','packages/fixtures/src/']]
const layers=Object.fromEntries(scopes.map(([label,prefix])=>{
 const rows=Object.entries(combined).filter(([name])=>name.startsWith(prefix)).map(([,row])=>row)
 return [label,Object.fromEntries(metrics.map(metric=>{
  const count=rows.reduce((sum,row)=>sum+row[metric].total,0),covered=rows.reduce((sum,row)=>sum+row[metric].covered,0)
  return [metric,{total:count,covered,pct:count?100*covered/count:null}]
 }))]
}))
const report={total,...combined}
mkdirSync(output,{recursive:true})
writeFileSync(join(output,'coverage-summary.json'),JSON.stringify(report,null,2))
writeFileSync(join(output,'coverage-layers.json'),JSON.stringify(layers,null,2))
if(paths.length)writeFileSync(join(output,'lcov.info'),paths.join('\n')+'\n')
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>NOVZI · Cobertura consolidada</title><style>body{font:16px system-ui;background:#f5f7fa;color:#192c41;max-width:900px;margin:36px auto;padding:20px}table{width:100%;border-collapse:collapse;background:white}td,th{padding:13px;border-bottom:1px solid #ddd;text-align:left}.bad{color:#b91c1c}.good{color:#15803d}a{color:#155bd3}</style></head><body><h1>NOVZI · Cobertura de código</h1><p>Backend/contratos: C8 · Frontend: Vitest/V8. Objetivo ≥${COVERAGE_TARGET}% en líneas, ramas, sentencias y funciones.</p><table><thead><tr><th>Métrica</th><th>Cubiertas / Total</th><th>Porcentaje</th><th>Estado</th></tr></thead><tbody>${metrics.map(m=>`<tr><td>${m}</td><td>${total[m].covered}/${total[m].total}</td><td>${total[m].pct}%</td><td class="${coveragePercent(total[m])>=COVERAGE_TARGET?'good':'bad'}">${coveragePercent(total[m])>=COVERAGE_TARGET?'Cumple':'Pendiente'}</td></tr>`).join('')}</tbody></table><h2>Capas independientes</h2><table><thead><tr><th>Capa</th>${metrics.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${Object.entries(layers).map(([label,values])=>`<tr><th>${label}</th>${metrics.map(m=>{const value=values[m].pct;return `<td class="${value!==null&&value>=COVERAGE_TARGET?'good':'bad'}">${value===null?'Sin unidades':value.toFixed(2)+'%'}</td>`}).join('')}</tr>`).join('')}</tbody></table><p>Consulta el detalle por archivo en <a href="backend/index.html">Backend y contratos</a> y <a href="frontend/index.html">Frontend React</a>.</p><p>Este informe mide cobertura de código instrumentado. Las pruebas E2E y de integración son controles adicionales, no sustitutos de la cobertura.</p></body></html>`
writeFileSync(join(output,'index.html'),html)
console.table(Object.fromEntries(metrics.map(m=>[m,`${total[m].pct}% (${total[m].covered}/${total[m].total})`])))
console.table(Object.fromEntries(Object.entries(layers).map(([label,values])=>[label,Object.fromEntries(metrics.map(m=>[m,values[m].pct===null?'N/D':values[m].pct.toFixed(2)+'%']))])))
console.log('[coverage] Informe consolidado generado en coverage/index.html')
