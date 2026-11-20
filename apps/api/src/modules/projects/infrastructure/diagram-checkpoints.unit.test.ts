import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc} from '@novzi/contracts'
import {affectedDiagramIds,diagramSnapshot,recordDiagramChanges} from './diagram-checkpoints'
import type {ProjectDocument} from '@novzi/contracts'

const fixture=()=>{
 const doc=emptyDoc(),element=createElement('Ficha común','actor')
 element.id='shared';doc.elements.shared=element
 doc.diagrams=[
  {id:'c2',type:'c2',name:'C2',createdAt:'2026-11-20',description:'',nodes:[{id:'c2-node',elementId:'shared',x:20,y:10}],edges:[]},
  {id:'flow',type:'process',name:'Flujo',createdAt:'2026-11-20',description:'',nodes:[{id:'flow-node',elementId:'shared',x:80,y:20}],edges:[]},
 ]
 return doc
}

test('cursor por diagrama: mover una caja de C2 no modifica el proceso',()=>{
 const before=fixture(),after=structuredClone(before)
 after.diagrams[0].nodes[0].x=120
 assert.deepEqual(affectedDiagramIds(before,after),['c2'])
 const snapshot=diagramSnapshot(after,'c2')!
 assert.equal(snapshot.diagram.id,'c2');assert.deepEqual(Object.keys(snapshot.elements),['shared'])
 assert.equal(diagramSnapshot(after,'otro'),null)
})
test('el catálogo es compartido: un cambio verdadero de ficha afecta ambas vistas',()=>{
 const before=fixture(),after=structuredClone(before)
 after.elements.shared.name='Ficha editada'
 assert.deepEqual(affectedDiagramIds(before,after),['c2','flow'])
})
test('vínculos por ocurrencia: dos vistas pueden navegar a cajas distintas sin colisión de catálogo',()=>{
 const before=fixture(),after=structuredClone(before)
 after.diagrams[0].nodes[0].childDiagramId='flow';after.diagrams[0].nodes[0].childNodeId='flow-node'
 assert.deepEqual(affectedDiagramIds(before,after),['c2'])
 assert.equal(after.elements.shared.childNodeId,undefined)
})
test('el backend incrementa el cursor de sólo la vista alterada y agrupa checkpoints',async()=>{
 const before=fixture(),after=structuredClone(before);after.diagrams[0].nodes[0].x=123
 const statements:{sql:string;params:unknown[]}[]=[]
 const query=async<T=unknown>(sql:string,params:unknown[]=[])=>{
  statements.push({sql,params})
  if(sql.includes('SELECT version,created_at,snapshot'))return {rows:[{version:1,created_at:new Date(),snapshot:diagramSnapshot(before,'c2')}]} as {rows:T[]}
  return {rows:[]} as {rows:T[]}
 }
 const changed=await recordDiagramChanges({query} as never,'p',before,after,2,'actor')
 assert.deepEqual(changed,['c2'])
 assert.equal(statements.filter(s=>s.sql.includes('INSERT INTO project_diagram_states')).length,1)
 assert.equal(statements.filter(s=>s.sql.includes('INSERT INTO project_diagram_checkpoints')).length,0)
})
test('no escribe ni consulta estados si la edición no cambia el documento',async()=>{
 const before:ProjectDocument=fixture(),queries:string[]=[]
 await recordDiagramChanges({query:async(sql:string)=>{queries.push(sql);return {rows:[]}}} as never,'p',before,structuredClone(before),5,'actor')
 assert.deepEqual(queries,[])
})
