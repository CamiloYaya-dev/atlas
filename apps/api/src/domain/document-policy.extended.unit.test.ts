import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,ROLE_PRESETS} from '@atlas/contracts'
import type {ModelElement,ProjectDocument} from '@atlas/contracts'
import {projectVisible,applyAuthorizedChange} from '../modules/projects/application/document-policy'
import type {Access} from '../security/roles'
function role(name='owner'):Access{return {roleId:'test',roleKey:name,roleName:name,permissions:new Set(ROLE_PRESETS.find(r=>r.key===name)!.permissions)}}
function fixture(){
 const d=emptyDoc()
 const a=createElement('Autenticación','activity'),b=createElement('Confirmar pago','activity'),c=createElement('Backend','container')
 Object.assign(a,{id:'a',group:'Autenticación'});Object.assign(b,{id:'b',group:'Pagos'});Object.assign(c,{id:'c',technical:'URL interna',childDiagramId:'c2'})
 d.elements={a,b,c}
 d.diagrams=[
 {id:'p',name:'Flujo de pagos',type:'process',description:'',createdAt:'2026-01-01',nodes:[{id:'na',elementId:'a',x:0,y:0},{id:'nb',elementId:'b',x:100,y:0},{id:'nc',elementId:'c',x:200,y:0}],edges:[{id:'e1',source:'na',target:'nb'}]},
 {id:'c2',name:'Contenedores',type:'c2',description:'',createdAt:'2026-01-01',nodes:[{id:'c-node',elementId:'c',x:100,y:100}],edges:[]}
 ]
 return d
}
function mutate(fn:(doc:ProjectDocument)=>void,as='owner'){
 const stored=fixture(),a=role(as),draft=projectVisible(stored,a)
 fn(draft)
 return applyAuthorizedChange(stored,draft,a)
}
test('edición de nombre, resumen, responsable, estado, enlaces y campos conservada',()=>{
 const result=mutate(d=>{Object.assign(d.elements.a,{name:'Ingreso SSO',summary:'Credenciales',owner:'QA',status:'Revisión',links:[{id:'l1',label:'Caso de uso',url:'https://example.com/cu'}],fields:{jira:'HU-14'}})})
 assert.equal(result.elements.a.name,'Ingreso SSO')
 assert.equal(result.elements.a.owner,'QA')
 assert.equal(result.elements.a.fields.jira,'HU-14')
 assert.equal(result.elements.a.links[0].label,'Caso de uso')
})
test('crear, renombrar y borrar un diagrama autorizado',()=>{
 const d=mutate(x=>{x.diagrams.push({id:'new',name:'Vista nueva',type:'custom',description:'',createdAt:'2026-01-01',nodes:[],edges:[]})})
 assert.ok(d.diagrams.some(x=>x.id==='new'))
 const submitted=projectVisible(d,role());submitted.diagrams.find(x=>x.id==='new')!.name='Vista final'
 const changed=applyAuthorizedChange(d,submitted,role())
 assert.equal(changed.diagrams.find(x=>x.id==='new')?.name,'Vista final')
 const deletion=projectVisible(changed,role());deletion.diagrams=deletion.diagrams.filter(x=>x.id!=='new')
 const next=applyAuthorizedChange(changed,deletion,role())
 assert.equal(next.diagrams.some(x=>x.id==='new'),false)
})
test('crear elemento y reutilizarlo en una vista',()=>{
 const result=mutate(d=>{const el=createElement('Caso de uso: iniciar sesión','usecase');el.id='cu';d.elements.cu=el;d.diagrams[0].nodes.push({id:'ncu',elementId:'cu',x:400,y:10})})
 assert.equal(result.elements.cu.type,'usecase')
 assert.ok(result.diagrams[0].nodes.some(n=>n.elementId==='cu'))
})
test('cambiar posición requiere exclusivamente permiso diagram.layout',()=>{
 const x=role('viewer');const doc=fixture(),visible=projectVisible(doc,x)
 visible.diagrams[0].nodes[0].x=301
 assert.throws(()=>applyAuthorizedChange(doc,visible,x),/diagram.layout.process/)
 const owner=role();assert.equal(mutate(d=>{d.diagrams[0].nodes[0].x=301}).diagrams[0].nodes[0].x,301)
})
test('crear/editar/borrar relaciones y validar permisos por tipo',()=>{
 const created=mutate(d=>d.diagrams[0].edges.push({id:'e2',source:'nb',target:'nc'}))
 assert.equal(created.diagrams[0].edges.length,2)
 const change=projectVisible(created,role());change.diagrams.find(x=>x.id==='p')!.edges.find(e=>e.id==='e2')!.label='Consulta API'
 const changed=applyAuthorizedChange(created,change,role())
 assert.equal(changed.diagrams[0].edges.find(e=>e.id==='e2')?.label,'Consulta API')
 const removal=projectVisible(changed,role());removal.diagrams.find(x=>x.id==='p')!.edges=removal.diagrams.find(x=>x.id==='p')!.edges.filter(e=>e.id!=='e2')
 const removed=applyAuthorizedChange(changed,removal,role())
 assert.equal(removed.diagrams[0].edges.length,1)
 const functional=role('functional'),draft=projectVisible(fixture(),functional)
 draft.diagrams[0].edges.push({id:'extra',source:'na',target:'nb',label:'Relación adicional'})
 assert.equal(applyAuthorizedChange(fixture(),draft,functional).diagrams[0].edges.length,2)
 const viewer=role('viewer'),invalid=projectVisible(fixture(),viewer)
 invalid.diagrams[0].edges.push({id:'not-allowed',source:'na',target:'nb'})
 assert.throws(()=>applyAuthorizedChange(fixture(),invalid,viewer),/relation.create.functional/)
})
test('rechaza conexiones a nodos ausentes e identidades duplicadas',()=>{
 assert.throws(()=>mutate(d=>d.diagrams[0].edges.push({id:'bad',source:'na',target:'unknown'})),/Relación/)
 assert.throws(()=>mutate(d=>d.diagrams[0].nodes.push({...d.diagrams[0].nodes[0]})),/duplicad/)
 assert.throws(()=>mutate(d=>d.diagrams[0].edges.push({...d.diagrams[0].edges[0]})),/duplicad/)
})
test('bloquea cambio de identidad de nodos y cambio de extremos de relaciones existentes',()=>{
 assert.throws(()=>mutate(d=>{d.diagrams[0].nodes[0].elementId='b'}),/identidad/)
 assert.throws(()=>mutate(d=>{d.diagrams[0].edges[0].target='nc'}),/extremos/)
})
test('impide eliminar elementos usados y diagramas vinculados',()=>{
 assert.throws(()=>mutate(d=>{delete d.elements.a}),/utilizado/)
 assert.throws(()=>mutate(d=>{d.diagrams=d.diagrams.filter(x=>x.id!=='c2')}),/vinculado/)
})
test('roles sin permisos de escritura no modifican metadatos ni añaden elementos',()=>{
 const d=fixture(),viewer=role('viewer'),incoming=projectVisible(d,viewer)
 incoming.diagrams[0].name='otro'
 assert.throws(()=>applyAuthorizedChange(d,incoming,viewer),/diagram.edit.process/)
 const fresh=projectVisible(d,viewer);const newEl=createElement('Fraude','activity');newEl.id='new';fresh.elements.new=newEl
 assert.throws(()=>applyAuthorizedChange(d,fresh,viewer),/element.create.activity/)
})
test('permiso de ver C1 no autoriza leer C2, C3 ni C4',()=>{
 const d=fixture(),functional=role('functional');const view=projectVisible(d,functional)
 assert.equal(view.diagrams.some(x=>x.type==='c2'),false)
 assert.equal(view.elements.c,undefined)
 assert.equal(view.diagrams[0].nodes.some(n=>n.elementId==='c'),false)
})
test('mantiene intactos los elementos técnicos invisibles durante edición funcional',()=>{
 const d=fixture(),f=role('functional'),visible=projectVisible(d,f)
 visible.elements.a.summary='Nuevo resumen'
 const merged=applyAuthorizedChange(d,visible,f)
 assert.equal(merged.elements.a.summary,'Nuevo resumen')
 assert.equal(merged.elements.c.technical,'URL interna')
 assert.equal(merged.diagrams.find(x=>x.id==='c2')?.nodes.length,1)
})
test('requiere privilegios especiales para cambiar campos configurables',()=>{
 const d=fixture(),functional=role('functional'),vis=projectVisible(d,functional)
 vis.fieldDefinitions.push({id:'j',label:'Jira',forType:'activity',kind:'url'})
 assert.throws(()=>applyAuthorizedChange(d,vis,functional),/field.configure/)
 const owner=mutate(d=>d.fieldDefinitions.push({id:'j',label:'Jira',forType:'activity',kind:'url'}))
 assert.ok(owner.fieldDefinitions.some(f=>f.id==='j'))
})
test('rechaza modificar detalles técnicos sin permiso explícito',()=>{
 const d=fixture(),a=role('viewer');a.permissions.add('element.edit.container');a.permissions.add('diagram.view.c2')
 const visible=projectVisible(d,a)
 visible.elements.c.technical='secreto alterado'
 assert.throws(()=>applyAuthorizedChange(d,visible,a),/element.technical.edit/)
})
test('prohíbe crear diagramas fuera del catálogo autorizado',()=>{
 const d=fixture(),a=role('functional'),visible=projectVisible(d,a)
 visible.diagrams.push({id:'illegal',name:'C4 ilegal',type:'c4',createdAt:'2026-01-01',description:'',nodes:[],edges:[]})
 assert.throws(()=>applyAuthorizedChange(d,visible,a),/diagram.create.c4/)
})

test('regresión: propietario conserva campos configurados al guardar un proyecto recién creado',()=>{
 const original=emptyDoc(),a=role('owner')
 const draft=projectVisible(original,a)
 // Even when no diagram references an element type, a role with field.configure
 // must receive the stored definitions; otherwise a valid first save gets 403.
 assert.deepEqual(draft.fieldDefinitions,original.fieldDefinitions)
 const activity=createElement('Acceder','activity');activity.id='activity'
 const endpoint=createElement('API privada','endpoint');endpoint.id='endpoint'
 draft.elements={activity,endpoint}
 draft.diagrams=[
  {id:'c1',name:'Contexto',type:'c1',description:'',createdAt:'2026-01-01',nodes:[{id:'a',elementId:'activity',x:1,y:2}],edges:[]},
  {id:'c2',name:'Contenedores',type:'c2',description:'',createdAt:'2026-01-01',nodes:[{id:'b',elementId:'endpoint',x:3,y:4}],edges:[]}
 ]
 const merged=applyAuthorizedChange(original,draft,a)
 assert.equal(merged.diagrams.length,2)
 assert.deepEqual(merged.fieldDefinitions,original.fieldDefinitions)
})

test('un lector sin field.configure no recibe definiciones de campos de elementos ocultos',()=>{
 const doc=fixture(),reader=role('viewer')
 const redacted=projectVisible(doc,reader)
 // Existing visible activities may include their own definitions, never the
 // endpoint-specific definition if there is no visible endpoint.
 assert.equal(redacted.fieldDefinitions.some(f=>f.forType==='endpoint'),false)
})

test('múltiples relaciones sobre el mismo par se guardan con permisos propios y no borran otras',()=>{
 const original=fixture(),actor=role(),incoming=projectVisible(original,actor)
 incoming.diagrams.find(d=>d.id==='p')!.edges.push(
  {id:'parallel2',source:'na',target:'nb',sourceHandle:'top-2',targetHandle:'bottom-3',label:'Auditoría'},
  {id:'parallel3',source:'na',target:'nb',sourceHandle:'right',targetHandle:'left',label:'Evento'}
 )
 const saved=applyAuthorizedChange(original,incoming,actor)
 assert.equal(saved.diagrams.find(d=>d.id==='p')?.edges.filter(e=>e.source==='na'&&e.target==='nb').length,3)
 const changed=projectVisible(saved,actor)
 changed.diagrams.find(d=>d.id==='p')!.edges=changed.diagrams.find(d=>d.id==='p')!.edges.filter(e=>e.id!=='parallel2')
 const afterDelete=applyAuthorizedChange(saved,changed,actor)
 assert.equal(afterDelete.diagrams.find(d=>d.id==='p')?.edges.length,2)
 assert.ok(afterDelete.diagrams.find(d=>d.id==='p')?.edges.some(e=>e.id==='parallel3'))
})
