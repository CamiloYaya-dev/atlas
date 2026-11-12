import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc,ROLE_PRESETS} from '@atlas/contracts'
import {projectVisible,applyAuthorizedChange} from '../modules/projects/application/document-policy'
import type {ProjectDocument} from '@atlas/contracts'
import type {Access} from '../security/roles'
const mk=(key:string):Access=>({roleId:'role',roleKey:key,roleName:key,permissions:new Set(ROLE_PRESETS.find(x=>x.key===key)!.permissions)})
function fixture():ProjectDocument{
 const d=emptyDoc(),functional=createElement('Validar pago','activity'),technical=createElement('Payment API','endpoint')
 functional.id='activity-a';technical.id='endpoint-b';technical.technical='token privado en pruebas ficticias'
 d.elements[functional.id]=functional;d.elements[technical.id]=technical
 d.diagrams=[
  {id:'p',name:'Pago',type:'process',description:'',createdAt:'2026-01-01',nodes:[{id:'pa',elementId:functional.id,x:10,y:10},{id:'pb',elementId:technical.id,x:100,y:10}],edges:[{id:'edge1',source:'pa',target:'pb',label:'llamada'}]},
  {id:'c3',name:'Componentes',type:'c3',description:'privado',createdAt:'2026-01-01',nodes:[{id:'tb',elementId:technical.id,x:20,y:10}],edges:[]}
 ]
 return d
}
test('Analista funcional no recibe C3 ni endpoint técnico en el documento',()=>{
 const doc=projectVisible(fixture(),mk('functional'))
 assert.equal(doc.diagrams.some(x=>x.id==='c3'),false)
 assert.equal(doc.elements['endpoint-b'],undefined)
 assert.equal(doc.elements['activity-a']?.name,'Validar pago')
 assert.equal(doc.diagrams[0].edges.length,0)
})
test('Arquitecto técnico no recibe actividad funcional',()=>{
 const doc=projectVisible(fixture(),mk('technical'))
 assert.equal(doc.diagrams.some(x=>x.id==='p'),false)
 assert.equal(doc.elements['activity-a'],undefined)
 assert.ok(doc.elements['endpoint-b'])
})
test('Analista edita actividad sin perder nodos y diagrama C3 ocultos',()=>{
 const original=fixture(),a=mk('functional'),incoming=projectVisible(original,a)
 incoming.elements['activity-a'].name='Validación de compra'
 const result=applyAuthorizedChange(original,incoming,a)
 assert.equal(result.elements['activity-a'].name,'Validación de compra')
 assert.equal(result.elements['endpoint-b'].technical,'token privado en pruebas ficticias')
 assert.equal(result.diagrams.find(x=>x.id==='c3')?.name,'Componentes')
 assert.equal(result.diagrams.find(x=>x.id==='p')?.nodes.length,2)
 assert.equal(result.diagrams.find(x=>x.id==='p')?.edges.length,1)
})
test('No permite crear relaciones mixtas sin permiso, aunque se falsifique JSON',()=>{
 const original=fixture(),a=mk('functional'),incoming=projectVisible(original,a)
 // Elevate element view to reveal endpoint and test relation gate independently.
 a.permissions.add('element.view.endpoint')
 const p=projectVisible(original,a)
 p.diagrams[0].edges.push({id:'edge2',source:'pa',target:'pb'})
 assert.throws(()=>applyAuthorizedChange(original,p,a),/relation.create.mixed/)
})
test('No permite insertar o alterar un diagrama no autorizado',()=>{
 const original=fixture(),a=mk('functional'),incoming=projectVisible(original,a)
 incoming.diagrams.push({...original.diagrams[1],name:'Fuga de C3'})
 assert.throws(()=>applyAuthorizedChange(original,incoming,a),/oculta/)
})
test('Un rol sin edición no puede editar el texto de un nodo',()=>{
 const original=fixture(),a=mk('viewer'),incoming=projectVisible(original,a)
 incoming.elements['activity-a'].name='Intento ilegal'
 assert.throws(()=>applyAuthorizedChange(original,incoming,a),/element.edit.activity/)
})
test('Propietario conserva todas las vistas y puede editar',()=>{
 const original=fixture(),a=mk('owner'),incoming=projectVisible(original,a)
 incoming.elements['endpoint-b'].name='Gateway API'
 const output=applyAuthorizedChange(original,incoming,a)
 assert.equal(output.elements['endpoint-b'].name,'Gateway API')
})
