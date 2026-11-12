import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createElement,emptyDoc,DIAGRAM_KINDS,ELEMENT_KINDS,PERMISSIONS} from '@atlas/contracts'
import type {ProjectDocument,DiagramType,ElementType} from '@atlas/contracts'
import {projectVisible,applyAuthorizedChange} from '../modules/projects/application/document-policy'
import type {Access} from '../security/roles'
const permit=(keys:string[]):Access=>({roleId:'custom',roleKey:'custom',roleName:'Personalizado',permissions:new Set(keys)})
for(const type of DIAGRAM_KINDS){
 test(`ACL matriz ${type}: vista permitida, creación denegada si falta permiso y autorizada cuando se concede`,()=>{
  const before=emptyDoc(),name=`Diagrama ${type}`
  const d={id:`test-${type}`,name,type,description:'',createdAt:'2026-11-11',nodes:[],edges:[]}
  const viewOnly=permit(['project.read',`diagram.view.${type}`])
  const posted={...projectVisible(before,viewOnly),diagrams:[d]}
  assert.throws(()=>applyAuthorizedChange(before,posted,viewOnly),new RegExp(`diagram.create.${type}`.replace('.','\\.')))
  const creator=permit(['project.read',`diagram.view.${type}`,`diagram.create.${type}`])
  const result=applyAuthorizedChange(before,{...projectVisible(before,creator),diagrams:[d]},creator)
  assert.equal(result.diagrams[0].type,type)
  assert.equal(projectVisible(result,permit(['project.read'])).diagrams.length,0)
 })
}
for(const type of ELEMENT_KINDS){
 test(`ACL matriz ${type}: creación, lectura y restricción por elemento`,()=>{
  const before=emptyDoc()
  before.diagrams=[{id:'d',name:'Prueba',type:'custom',description:'',createdAt:'2026-11-11',nodes:[],edges:[]}]
  const el=createElement(`Elemento ${type}`,type,'QA');el.id=`elem-${type}`
  const viewer=permit(['project.read','diagram.view.custom',`element.view.${type}`,'diagram.layout.custom'])
  const posted=projectVisible(before,viewer);posted.elements[el.id]=el;posted.diagrams[0].nodes.push({id:`node-${type}`,elementId:el.id,x:1,y:2})
  assert.throws(()=>applyAuthorizedChange(before,posted,viewer),new RegExp(`element.create.${type}`.replace('.','\\.')))
  const creator=permit([...viewer.permissions,`element.create.${type}`])
  const document=projectVisible(before,creator);document.elements[el.id]=el;document.diagrams[0].nodes.push({id:`node-${type}`,elementId:el.id,x:1,y:2})
  const result=applyAuthorizedChange(before,document,creator)
  assert.equal(result.elements[el.id].type,type)
  assert.equal(Object.keys(projectVisible(result,permit(['project.read','diagram.view.custom'])).elements).length,0)
 })
}
for(const [scope,a,b] of [['functional','activity','requirement'],['technical','endpoint','database'],['mixed','activity','endpoint']] as const){
 test(`ACL matriz de relaciones ${scope}: bloqueo independiente de creación`,()=>{
  const before=emptyDoc(),left=createElement('Origen',a),right=createElement('Destino',b)
  left.id='source';right.id='target';before.elements={source:left,target:right}
  before.diagrams=[{id:'d',name:'Diagrama',type:'custom',description:'',createdAt:'2026-11-11',nodes:[{id:'a',elementId:'source',x:0,y:0},{id:'b',elementId:'target',x:1,y:0}],edges:[]}]
  const keys=['project.read','diagram.view.custom',`element.view.${a}`,`element.view.${b}`]
  const disallowed=permit(keys),doc=projectVisible(before,disallowed)
  doc.diagrams[0].edges.push({id:'test',source:'a',target:'b'})
  assert.throws(()=>applyAuthorizedChange(before,doc,disallowed),new RegExp(`relation.create.${scope}`.replace('.','\\.')))
  const granted=permit([...keys,`relation.create.${scope}`]),authorized=projectVisible(before,granted)
  authorized.diagrams[0].edges.push({id:'test',source:'a',target:'b'})
  assert.equal(applyAuthorizedChange(before,authorized,granted).diagrams[0].edges.length,1)
 })
}
test('la proyección por permisos es profunda: nunca comparte referencias mutables con original',()=>{
 const original=emptyDoc();const e=createElement('Secreto','endpoint');e.id='e';e.fields={secret:'a'};e.links=[{id:'l',label:'Jira',url:'https://example.com'}];original.elements={e}
 original.diagrams=[{id:'d',name:'C2',type:'c2',description:'',createdAt:'2026-11-11',nodes:[{id:'n',elementId:'e',x:1,y:2}],edges:[]}]
 const visible=projectVisible(original,permit(['project.read','diagram.view.c2','element.view.endpoint']))
 visible.elements.e.fields.secret='modificado';visible.elements.e.links[0].label='Otro';visible.diagrams[0].nodes[0].x=500
 assert.equal(original.elements.e.fields.secret,'a')
 assert.equal(original.elements.e.links[0].label,'Jira')
 assert.equal(original.diagrams[0].nodes[0].x,1)
})
