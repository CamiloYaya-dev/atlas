import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,mergeProjectDocuments,MergeConflict} from './index'
import type {ProjectDocument} from './index'

const fixture=()=>{
 const doc=emptyDoc()
 const a=createElement('Caja A','activity'),b=createElement('Caja B','component')
 a.id='a';b.id='b'
 doc.elements={a,b}
 doc.diagrams=[
  {id:'c1',name:'Contexto',type:'c1',description:'',createdAt:'2026-01-01',nodes:[{id:'na',elementId:'a',x:10,y:10}],edges:[]},
  {id:'c2',name:'Contenedores',type:'c2',description:'',createdAt:'2026-01-01',nodes:[{id:'nb',elementId:'b',x:20,y:20}],edges:[]},
 ]
 return doc
}
const clone=(doc:ProjectDocument):ProjectDocument=>structuredClone(doc)

test('colaboración: ediciones simultáneas en C1 y C2 se fusionan, sin pisarse',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.diagrams[0].name='Contexto actualizado por A'
 b.diagrams[1].description='Contenedores actualizados por B'
 const result=mergeProjectDocuments(base,b,a)
 assert.equal(result.diagrams[0].name,'Contexto actualizado por A')
 assert.equal(result.diagrams[1].description,'Contenedores actualizados por B')
 assert.equal(base.diagrams[0].name,'Contexto')
})
test('colaboración: campos diferentes de la misma caja se conservan',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.elements.a.name='Nombre actualizado'
 b.elements.a.summary='Resumen simultáneo'
 const merged=mergeProjectDocuments(base,b,a)
 assert.equal(merged.elements.a.name,'Nombre actualizado')
 assert.equal(merged.elements.a.summary,'Resumen simultáneo')
})
test('colaboración: conflictos en el mismo campo NO se resuelven mediante sobrescritura',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.elements.a.name='Nombre A';b.elements.a.name='Nombre B'
 assert.throws(()=>mergeProjectDocuments(base,b,a),(err:unknown)=>err instanceof MergeConflict&&err.path==='document.elements.a.name')
})
test('colaboración: varias cajas independientes creadas en el mismo diagrama se preservan',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.diagrams[0].nodes.push({id:'a-2',elementId:'a',x:35,y:40})
 b.diagrams[0].nodes.push({id:'b-2',elementId:'b',x:55,y:60})
 const result=mergeProjectDocuments(base,b,a)
 assert.deepEqual(new Set(result.diagrams[0].nodes.map(n=>n.id)),new Set(['na','a-2','b-2']))
})
test('colaboración: un movimiento simultáneo del mismo nodo produce conflicto',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.diagrams[0].nodes[0].x=45;b.diagrams[0].nodes[0].x=90
 assert.throws(()=>mergeProjectDocuments(base,b,a),MergeConflict)
})
test('colaboración: eliminar una caja que otra persona modificó produce conflicto',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.diagrams[0].nodes=[]
 b.diagrams[0].nodes[0].x=88
 assert.throws(()=>mergeProjectDocuments(base,b,a),MergeConflict)
})
test('colaboración: añadir definiciones y campos simultáneos no destruye otros campos',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.fieldDefinitions.push({id:'f-a',label:'Campo A',forType:'all',kind:'text'})
 b.fieldDefinitions.push({id:'f-b',label:'Campo B',forType:'all',kind:'text'})
 a.elements.a.fields['x']='valor A';b.elements.a.fields['y']='valor B'
 const merged=mergeProjectDocuments(base,b,a)
 assert.deepEqual(new Set(merged.fieldDefinitions.map(f=>f.id)),new Set([...base.fieldDefinitions.map(f=>f.id),'f-a','f-b']))
 assert.deepEqual(merged.elements.a.fields,{x:'valor A',y:'valor B'})
})
test('colaboración: una eliminación sin modificaciones concurrentes se respeta',()=>{
 const base=fixture()
 base.elements.c={...base.elements.a,id:'c',name:'Sin diagrama'}
 const a=clone(base),b=clone(base)
 delete a.elements.c
 b.elements.a.summary='Edición independiente'
 const merged=mergeProjectDocuments(base,a,b)
 assert.equal(merged.elements.c,undefined)
 assert.equal(merged.elements.a.summary,'Edición independiente')
})
test('colaboración: creación concurrente de IDs iguales y datos incompatibles se bloquea',()=>{
 const base=fixture(),a=clone(base),b=clone(base)
 a.elements.c={...base.elements.a,id:'c',name:'Creado por A'}
 b.elements.c={...base.elements.a,id:'c',name:'Creado por B'}
 assert.throws(()=>mergeProjectDocuments(base,a,b),MergeConflict)
})
