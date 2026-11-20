import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
const source='apps/web/src/features/editor/domain/manual-edge-routing.ts'
const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const mod={};vm.runInNewContext(js,{exports:mod,require,console},{filename:source})
const {enforcePortLegs,removeRouteBend,simplifyRoute,snapSegmentToPeers,privateWireSpans,toManualRoute,compatibleSharedRoute}=mod
const plain=x=>JSON.parse(JSON.stringify(x))
const vectors={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]}
const isOut=(a,b,side)=>{
 const v=vectors[side],delta=[b.x-a.x,b.y-a.y]
 return delta[0]*v[0]+delta[1]*v[1]>=12&&delta[0]*v[1]===delta[1]*v[0]
}
const isOrth=points=>points.slice(1).every((p,i)=>p.x===points[i].x||p.y===points[i].y)
for(const s of Object.keys(vectors))for(const t of Object.keys(vectors))test(`puertos ${s}/${t}: salida y llegada ortogonales`,()=>{
 const from={x:100,y:100},to={x:300,y:300}
 const r=enforcePortLegs([from,{x:150,y:155},to],s,t)
 assert.deepEqual(plain(r[0]),from);assert.deepEqual(plain(r.at(-1)),to)
 assert.ok(isOrth(r),`No ortogonal: ${JSON.stringify(r)}`)
 assert.ok(isOut(from,r[1],s),`Puerto de salida ${s} mal dirigido`)
 assert.ok(isOut(to,r.at(-2),t),`Puerto de llegada ${t} mal dirigido`)
})
test('puerto derecho nunca vuelve a la izquierda en el primer segmento, aun con destino detrás',()=>{
 const r=enforcePortLegs([{x:100,y:100},{x:30,y:130},{x:20,y:200}],'right','left')
 assert.ok(isOrth(r));assert.ok(r[1].x>=124);assert.ok(r.at(-2).x<=8)
})
test('eliminar giro conserva los extremos y las direcciones obligatorias',()=>{
 const start={x:20,y:40},end={x:320,y:140}
 const initial=enforcePortLegs([start,{x:90,y:40},{x:90,y:90},{x:260,y:90},end],'right','left')
 const next=removeRouteBend(initial,2,'right','left')
 assert.deepEqual(plain(next[0]),start);assert.deepEqual(plain(next.at(-1)),end)
 assert.ok(isOrth(next));assert.ok(isOut(start,next[1],'right'));assert.ok(isOut(end,next.at(-2),'left'))
 assert.ok(toManualRoute(next).points.length<=24)
})
test('simplificar elimina desvíos sin cambiar cajas ni etiqueta',()=>{
 const a={x:20,y:40},b={x:320,y:140}
 const many=enforcePortLegs([a,{x:75,y:40},{x:75,y:-60},{x:200,y:-60},{x:200,y:200},{x:250,y:200},b],'right','left')
 const simple=simplifyRoute(many,'right','left')
 assert.ok(simple.length<many.length)
 assert.deepEqual(plain(simple[0]),a);assert.deepEqual(plain(simple.at(-1)),b)
 assert.ok(isOrth(simple))
})
test('alineación magnética fusiona el tramo con otro compatible en 12 px',()=>{
 const points=[{x:20,y:40},{x:80,y:40},{x:80,y:80},{x:240,y:80},{x:240,y:140},{x:320,y:140}]
 const peers=[{id:'other-edge',points:[{x:80,y:92},{x:240,y:92}]}]
 const result=snapSegmentToPeers(points,2,5,peers)
 assert.equal(result.peerId,'other-edge');assert.equal(result.points[2].y,92);assert.equal(result.points[3].y,92)
 assert.deepEqual(plain(result.points[0]),points[0]);assert.deepEqual(plain(result.points.at(-1)),points.at(-1))
})
test('tramo compatible coincidente se dibuja sin halo blanco doble',()=>{
 const points=[{x:10,y:30},{x:150,y:30},{x:150,y:100}]
 const privateParts=privateWireSpans(points,[{id:'other',points:[{x:60,y:30},{x:100,y:30}]}])
 assert.deepEqual(plain(privateParts),[
  {a:{x:10,y:30},b:{x:60,y:30}},
  {a:{x:100,y:30},b:{x:150,y:30}},
  {a:{x:150,y:30},b:{x:150,y:100}}
 ])
})
test('giros opcionales no admiten puntos sin finitud',()=>{
 assert.throws(()=>toManualRoute([{x:0,y:0},{x:Infinity,y:45},{x:320,y:45}]))
})

test('no fusiona dependencia por defecto discontinua con dependencia explícitamente sólida',()=>{
 assert.equal(compatibleSharedRoute({relationKind:'dependency'},{relationKind:'dependency',lineStyle:'solid'}),false)
 assert.equal(compatibleSharedRoute({relationKind:'dependency'},{relationKind:'dependency',lineStyle:'dashed'}),true)
})
test('no fusiona tipos ni direcciones diferentes',()=>{
 assert.equal(compatibleSharedRoute({relationKind:'dependency',lineStyle:'dashed'},{relationKind:'association',lineStyle:'dashed'}),false)
 assert.equal(compatibleSharedRoute({relationKind:'dependency',direction:'reverse'},{relationKind:'dependency',direction:'forward'}),false)
})

test('rebase mantiene la etiqueta manual cerca de la relación al desplazar una caja',()=>{
 const file='apps/web/src/features/editor/domain/diagram-beautify.ts'
 const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const lib={};vm.runInNewContext(output,{exports:lib,require:()=>({}),console},{filename:file})
 const before={diagrams:[{id:'d',nodes:[{id:'a',x:0,y:0,width:100,height:80},{id:'b',x:300,y:0,width:100,height:80}],edges:[{id:'r',source:'a',target:'b',labelPosition:{mode:'manual',x:200,y:-25}}]}]}
 const after=plain(before);after.diagrams[0].nodes[1].x=400
 const result=lib.rebaseManualRoutes(before,after,'d')
 assert.deepEqual(plain(result.diagrams[0].edges[0].labelPosition),{mode:'manual',x:250,y:-25})
 assert.equal(result.diagrams[0].edges[0].id,'r')
})

test('contrato acepta posición manual válida de etiqueta',()=>{
 const source='packages/contracts/src/index.ts'
 const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const library={};vm.runInNewContext(js,{exports:library,require:()=>({}),crypto:{randomUUID:()=>''},console},{filename:source})
 assert.equal(library.validEdgeLabelPosition({mode:'manual',x:135.5,y:-9}),true)
 assert.equal(library.validEdgeLabelPosition({mode:'manual',x:0,y:0}),true)
})
test('contrato rechaza etiqueta fuera de rango, modo desconocido o datos no finitos',()=>{
 const source='packages/contracts/src/index.ts'
 const js=ts.transpileModule(fs.readFileSync(source,'utf8'),{fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const library={};vm.runInNewContext(js,{exports:library,require:()=>({}),crypto:{randomUUID:()=>''},console},{filename:source})
 for(const item of [{mode:'auto',x:2,y:3},{mode:'manual',x:Infinity,y:0},{mode:'manual',x:1e10,y:0},{mode:'manual',x:0,y:NaN},{mode:'manual',x:'10',y:50},null])assert.equal(library.validEdgeLabelPosition(item),false)
})
