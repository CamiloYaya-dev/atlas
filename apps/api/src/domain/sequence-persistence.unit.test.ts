import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc,canonicalUmlEdge} from '@atlas/contracts'
import type {ProjectDocument} from '@atlas/contracts'
import {ensureUniqueIds,applyAuthorizedChange} from '../modules/projects/application/document-policy'
import type {Access} from '../security/roles'
import {createDiagram,addElementNode,setNodePackage,resizeNode,connectNodes} from '../../../web/src/features/editor/domain/document-commands'
const owner:Access={roleId:'owner',roleKey:'owner',roleName:'Owner',permissions:new Set()}
function fixture(){
 let d=createDiagram(emptyDoc(),{id:'seq',name:'Secuencia QA',type:'uml-sequence',date:'2026-11-14'})
 for(const [id,kind,x,y] of [['a','uml-lifeline',0,0],['b','uml-lifeline',500,0],['aa','uml-activation',50,70],['bb','uml-activation',550,70],['end','uml-destruction',50,500]] as const)d=addElementNode(d,'seq',{...createElement(id,kind),id},{id,x,y})
 d=resizeNode(d,'seq','a',170,500);d=resizeNode(d,'seq','b',170,500);d=setNodePackage(d,'seq','aa','a');d=setNodePackage(d,'seq','bb','b');d=resizeNode(d,'seq','aa',48,300);d=resizeNode(d,'seq','bb',48,300);return d
}
const diagram=(d:ProjectDocument)=>d.diagrams[0]
test('modelo real del editor: destrucción al final de una ejecución redimensionada pasa la política y conserva el JSON',()=>{
 const original=fixture();let draft=setNodePackage(original,'seq','end','aa');draft=resizeNode(draft,'seq','aa',48,340)
 ensureUniqueIds(draft);const saved=applyAuthorizedChange(original,draft,owner)
 const end=diagram(saved).nodes.find(n=>n.id==='end')!;assert.equal(end.parentNodeId,'aa');assert.equal(end.y,316);assert.equal(end.x,0)
 assert.deepEqual(JSON.parse(JSON.stringify(saved)),JSON.parse(JSON.stringify(draft)))
})
test('destrucción centrada al final del participante es válida, pero una fuera del extremo se rechaza',()=>{
 const original=fixture(),draft=setNodePackage(original,'seq','end','b');ensureUniqueIds(draft)
 const end=diagram(draft).nodes.find(n=>n.id==='end')!;assert.equal(end.y,476);end.y=900;assert.throws(()=>ensureUniqueIds(draft),/fuera de contenedor|cortar sus elementos/)
})
test('seis mensajes de ida y vuelta con distintas alturas sobreviven a política de guardado y validación de puertos',()=>{
 const original=fixture();let draft=original
 for(let i=1;i<=6;i++){const forward=i%2===1;draft=connectNodes(draft,'seq',canonicalUmlEdge('uml-sequence',{id:`m${i}`,source:forward?'aa':'bb',target:forward?'bb':'aa',sourceHandle:`seq-${forward?'right':'left'}-${i}`,targetHandle:`seq-${forward?'left':'right'}-${i}`,relationKind:forward?'message':'reply',label:`mensaje ${i}`}))}
 const saved=applyAuthorizedChange(original,draft,owner);assert.equal(diagram(saved).edges.length,6);assert.equal(new Set(diagram(saved).edges.map(e=>e.sourceHandle)).size,6)
 const bad=structuredClone(saved);diagram(bad).edges[0].sourceHandle='seq-right-999';assert.throws(()=>ensureUniqueIds(bad),/Puerto de salida/)
 const badTarget=structuredClone(saved);diagram(badTarget).edges[0].targetHandle='seq-left-999';assert.throws(()=>ensureUniqueIds(badTarget),/Puerto de entrada/)
})
