import test from 'node:test'
import assert from 'node:assert/strict'
import {planE2eBatches,assertBatchSelection,assertBatchRun,selectE2eBatches} from './e2e-batches.mjs'
const spec=(id,line,title=id,file='atlas.spec.ts')=>({id,line,title,file,tests:[{projectId:'chromium',expectedStatus:'passed'}]})
const report=(...specs)=>({suites:[{specs}],errors:[]})
test('conserva pruebas nuevas, agrupa variantes de una línea y aísla recorridos pesados',()=>{
 const all=report(spec('a',1),spec('b',2),spec('c',3,'UML Clases QA'),spec('d',4),spec('e',4),spec('f',5,'nuevo','nested/new.spec.ts'))
 const batches=planE2eBatches(all)
 assert.deepEqual(batches.map(b=>b.selectors),[['atlas.spec.ts:1','atlas.spec.ts:2'],['atlas.spec.ts:3'],['atlas.spec.ts:4'],['nested/new.spec.ts:5']])
 assert.equal(batches.flatMap(b=>b.ids).length,6)
 assertBatchSelection(batches[2],report(all.suites[0].specs[3],all.suites[0].specs[4]))
 assert.throws(()=>assertBatchSelection(batches[2],report(all.suites[0].specs[3])),/incompleta/)
})
test('no certifica listas vacías, errores, skips, duplicados ni archivos externos',()=>{
 assert.throws(()=>planE2eBatches(report()),/no enumeró/)
 assert.throws(()=>planE2eBatches({...report(spec('a',1)),errors:[{}]}),/enumerar/)
 assert.throws(()=>planE2eBatches(report(spec('a',1),spec('a',2))),/duplicada/)
 const skipped=spec('s',1);skipped.tests[0].expectedStatus='skipped';assert.throws(()=>planE2eBatches(report(skipped)),/omitida/)
 assert.throws(()=>planE2eBatches(report(spec('a',1,'a','../outside.spec.ts'))),/inválido/)
})
test('lotes tienen un máximo de ubicaciones y conservan recursión en describe',()=>{
 const r={suites:[{specs:[spec('a',1)],suites:[{specs:[spec('b',2),spec('c',3),spec('d',4)]}]}]}
 assert.deepEqual(planE2eBatches(r,{maxLocations:2}).map(b=>b.ids.length),[2,2])
})

test('reporte real exige que todas las pruebas enumeradas hayan pasado, sin skip ni flaky',()=>{
 const r=report(spec('a',1));const batch=planE2eBatches(r)[0];const stats={expected:1,skipped:0,unexpected:0,flaky:0}
 assertBatchRun(batch,{...r,stats});for(const wrong of [{expected:0},{skipped:1},{unexpected:1},{flaky:1}])assert.throws(()=>assertBatchRun(batch,{...r,stats:{...stats,...wrong}}),/no aprobada/)
})

test('diagnóstico explícito por lote no altera la selección integral y rechaza argumentos inválidos',()=>{
 const batches=planE2eBatches(report(spec('a',1),spec('b',2,'UML Clases QA')))
 assert.deepEqual(selectE2eBatches(batches),{batches,list:false,partial:false})
 assert.deepEqual(selectE2eBatches(batches,['--batch=batch-02']),{batches:[batches[1]],list:false,partial:true})
 assert.equal(selectE2eBatches(batches,['--list','--batch=batch-02']).list,true)
 for(const flags of [['--batch=batch-99'],['--batch=../../x'],['--batch=batch-01','--batch=batch-02'],['--grep=x'],['--list','--list']])assert.throws(()=>selectE2eBatches(batches,flags))
})
