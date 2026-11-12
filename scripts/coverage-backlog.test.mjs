import test from 'node:test'
import assert from 'node:assert/strict'
import {buildBacklog} from './coverage-backlog.mjs'
const metric=(total,covered)=>({total,covered,skipped:0,pct:total?100*covered/total:100})
const row=(total,covered)=>({lines:metric(total,covered),statements:metric(total,covered),functions:metric(total,covered),branches:metric(total,covered)})
test('backlog detecta 0% y calcula las unidades reales faltantes para 95%',()=>{
 const summary={total:row(100,50),'apps/web/src/features/editor/AtlasEditor.tsx':row(100,0)}
 const result=buildBacklog(summary)
 assert.equal(result.files.length,1)
 assert.equal(result.files[0].priority,1)
 assert.equal(result.files[0].gaps.lines.remaining,95)
 assert.equal(result.totals.lines.missingToTarget,45)
})
test('no introduce pendientes falsos cuando cobertura cumple el 95%',()=>{
 const result=buildBacklog({total:row(100,95),'apps/web/src/complete.ts':row(20,19)})
 assert.equal(result.files.length,0)
})
test('calcula el 95% por archivo, no solo a nivel global',()=>{
 const result=buildBacklog({total:row(200,190),'a.ts':row(10,8),'b.ts':row(190,182)})
 assert.equal(result.totals.lines.missingToTarget,0)
 assert.equal(result.files.length,1)
 assert.equal(result.files.find(x=>x.file==='a.ts').gaps.lines.remaining,2)
})
test('no silencia un reporte malformado',()=>{
 assert.throws(()=>buildBacklog({total:row(10,5),'bad.ts':{}}),/Falta lines/)
})
