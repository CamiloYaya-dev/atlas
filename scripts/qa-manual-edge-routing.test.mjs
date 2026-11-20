import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const source='apps/web/src/features/editor/domain/manual-edge-routing.ts'
const transpiled=ts.transpileModule(fs.readFileSync(source,'utf8'),{fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exported={}
vm.runInNewContext(transpiled,{exports:exported,require,console},{filename:source})
const {editableRoute,shiftSegment,toManualRoute,isValidManualRoute,insertDogleg,polylinePath,compactPolyline,orthogonalize}=exported
const normalize=o=>JSON.parse(JSON.stringify(o))
test('un tramo se mueve sin desplazar las cajas extremas',()=>{
 const from={x:20,y:50},to={x:320,y:50}
 const route=editableRoute(from,to,undefined,'right','left')
 const next=shiftSegment(route,0,65)
 assert.deepEqual(normalize(next[0]),from)
 assert.deepEqual(normalize(next.at(-1)),to)
 assert.ok(next.some(p=>p.y===115))
 assert.ok(toManualRoute(next).points.length>0)
})
test('giro manual sobrevive serializar/deserializar y sigue ortogonal',()=>{
 const path=insertDogleg([{x:0,y:0},{x:240,y:0}],0,45)
 const manual=toManualRoute(path)
 const restored=editableRoute({x:0,y:0},{x:240,y:0},normalize(manual),'right','left')
 assert.deepEqual(normalize(restored),normalize(path))
 assert.ok(/L 240 45/.test(polylinePath(restored).path))
})
test('no acumula puntos duplicados ni tramos redundantes',()=>{
 assert.deepEqual(normalize(compactPolyline([{x:0,y:0},{x:0,y:0},{x:40,y:0},{x:90,y:0}])),[{x:0,y:0},{x:90,y:0}])
})
test('limita bends e impide coordenadas infinitas o desmesuradas',()=>{
 assert.equal(isValidManualRoute({version:1,points:[{x:Infinity,y:1}]}),false)
 assert.equal(isValidManualRoute({version:1,points:[{x:1e25,y:1}]}),false)
 assert.equal(isValidManualRoute({version:1,points:Array.from({length:25},(_,i)=>({x:i,y:0}))}),false)
})
test('los tramos diagonales de ajuste se ortogonalizan',()=>{
 const route=orthogonalize([{x:0,y:0},{x:100,y:45},{x:200,y:0}],'right','left')
 assert.deepEqual(normalize(route[0]),{x:0,y:0})
 assert.deepEqual(normalize(route.at(-1)),{x:200,y:0})
 for(let i=1;i<route.length;i++)assert.ok(route[i].x===route[i-1].x||route[i].y===route[i-1].y)
})
