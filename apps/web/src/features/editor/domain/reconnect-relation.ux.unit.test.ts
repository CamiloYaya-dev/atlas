import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDoc, createElement } from '@novzi/contracts'
import { reconnectRelation } from './document-commands'

function fixture(){
 const doc=emptyDoc()
 const a=createElement('Web','actor'),b=createElement('Servicio','system'),c=createElement('Pago','system')
 a.id='a';b.id='b';c.id='c'
 doc.elements={a,b,c}
 doc.diagrams=[{id:'q',name:'Contexto',type:'c1',description:'',createdAt:'2026-11-17',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:250,y:0},{id:'c',elementId:'c',x:500,y:0}],edges:[{id:'r1',source:'a',target:'b',sourceHandle:'right',targetHandle:'left',label:'Autenticación',description:'Mediante TLS',pathStyle:'smoothstep'}]}]
 return doc
}
test('reconexión visual conserva identidad, etiquetas y descripción y no muta el original',()=>{
 const original=fixture()
 const next=reconnectRelation(original,'q','r1',{source:'a',target:'c',sourceHandle:'bottom',targetHandle:'top'})
 const before=original.diagrams[0].edges[0],after=next.diagrams[0].edges[0]
 assert.equal(before.target,'b')
 assert.equal(after.id,'r1');assert.equal(after.source,'a');assert.equal(after.target,'c')
 assert.equal(after.description,'Mediante TLS');assert.equal(after.label,'Autenticación')
 assert.equal(after.sourceHandle,'bottom');assert.equal(after.targetHandle,'top')
 assert.equal(after.pathStyle,'smoothstep')
 assert.equal(next.diagrams[0].edges.length,1)
})
test('rechaza extremos inexistentes sin modificar el documento',()=>{
 const original=fixture()
 assert.throws(()=>reconnectRelation(original,'q','r1',{source:'a',target:'absent',sourceHandle:'right',targetHandle:'left'}),/cajas existentes/)
 assert.equal(original.diagrams[0].edges[0].target,'b')
})
test('bloquea autoconexión inválida y preserva el enlace anterior',()=>{
 const original=fixture()
 assert.throws(()=>reconnectRelation(original,'q','r1',{source:'a',target:'a',sourceHandle:'right',targetHandle:'left'}),/Autoconexión/)
 assert.equal(original.diagrams[0].edges[0].target,'b')
})
test('una reconexión idéntica es idempotente',()=>{
 const original=fixture()
 assert.strictEqual(reconnectRelation(original,'q','r1',{source:'a',target:'b',sourceHandle:'right',targetHandle:'left'}),original)
})
