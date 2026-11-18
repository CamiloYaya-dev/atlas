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
test('bloquea cambio de identidad; reconecta extremos visibles con la identidad de relación intacta',()=>{
 assert.throws(()=>mutate(d=>{d.diagrams[0].nodes[0].elementId='b'}),/identidad/)
 const changed=mutate(d=>{d.diagrams[0].edges[0].target='nc'})
 assert.equal(changed.diagrams[0].edges[0].id,'e1')
 assert.equal(changed.diagrams[0].edges[0].target,'nc')
 assert.equal(changed.diagrams[0].edges.length,1)
 const viewer=role('viewer'),stored=fixture(),visible=projectVisible(stored,viewer)
 visible.diagrams[0].edges[0].target='nc'
 assert.throws(()=>applyAuthorizedChange(stored,visible,viewer),/relation.edit.functional/)
 assert.equal(stored.diagrams[0].edges[0].target,'nb')
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

test('cambiar el tipo de elemento exige permiso de edición, creación y visibilidad del destino',()=>{
 const original=fixture(),editor:Access={roleId:'qa',roleKey:'qa',roleName:'QA',permissions:new Set(['diagram.view.process','element.view.activity','element.edit.activity'])}
 const draft=projectVisible(original,editor);draft.elements.a.type='usecase'
 assert.throws(()=>applyAuthorizedChange(original,draft,editor),/element.create.usecase/)
 editor.permissions.add('element.create.usecase');assert.throws(()=>applyAuthorizedChange(original,draft,editor),/element.view.usecase/)
 editor.permissions.add('element.view.usecase');const saved=applyAuthorizedChange(original,draft,editor)
 assert.equal(saved.elements.a.type,'usecase');assert.equal(saved.diagrams[0].nodes[0].elementId,'a');assert.equal(original.elements.a.type,'activity')
})
test('enlace granular no permite descubrir una vista o caja oculta mediante ID conocido',()=>{
 const original=fixture(),editor:Access={roleId:'qa',roleKey:'qa',roleName:'QA',permissions:new Set(['diagram.view.process','element.view.activity','element.edit.activity'])}
 let draft=projectVisible(original,editor);Object.assign(draft.elements.a,{childDiagramId:'c2',childNodeId:'c-node'})
 assert.throws(()=>applyAuthorizedChange(original,draft,editor),/diagram.view.c2/)
 editor.permissions.add('diagram.view.c2');draft=projectVisible(original,editor);Object.assign(draft.elements.a,{childDiagramId:'c2',childNodeId:'c-node'})
 // Simula un cliente que falsifica el nodo oculto con un ID conocido.
 draft.diagrams.find(d=>d.id==='c2')!.nodes.push({...original.diagrams[1].nodes[0]})
 assert.throws(()=>applyAuthorizedChange(original,draft,editor),/element.view.container/)
 editor.permissions.add('element.view.container');draft=projectVisible(original,role());Object.assign(draft.elements.a,{childDiagramId:'c2',childNodeId:'c-node'})
 // The owner can persist the authorized granular link without changing the target.
 const saved=applyAuthorizedChange(original,draft,role());assert.equal(saved.elements.a.childNodeId,'c-node');assert.equal(saved.elements.a.childDiagramId,'c2')
 assert.equal(original.elements.a.childDiagramId,undefined)
})
test('una vista existente no cambia de tipo si el editor carece de permisos sobre el nuevo tipo',()=>{
 const original=fixture(),editor:Access={roleId:'qa',roleKey:'qa',roleName:'QA',permissions:new Set(['diagram.view.process','diagram.edit.process','element.view.activity'])}
 const draft=projectVisible(original,editor);draft.diagrams[0].type='custom'
 assert.throws(()=>applyAuthorizedChange(original,draft,editor),/diagram.create.custom/)
 editor.permissions.add('diagram.create.custom');assert.throws(()=>applyAuthorizedChange(original,draft,editor),/diagram.view.custom/)
 editor.permissions.add('diagram.view.custom');const result=applyAuthorizedChange(original,draft,editor)
 assert.equal(result.diagrams[0].type,'custom');assert.equal(result.diagrams[0].nodes.length,original.diagrams[0].nodes.length)
})

test('un nodo oculto no puede ser reemplazado por un nodo visible con el mismo ID',()=>{
 const original=fixture(),actor=role('functional'),draft=projectVisible(original,actor)
 draft.diagrams[0].nodes.push({id:'nc',elementId:'a',x:12,y:20})
 assert.throws(()=>applyAuthorizedChange(original,draft,actor),/ID de nodo reservado/)
 assert.equal(original.diagrams[0].nodes.find(n=>n.id==='nc')?.elementId,'c')
})
test('una nueva vista no acepta una caja cuyo elemento no existe',()=>{
 const original=fixture(),draft=projectVisible(original,role())
 draft.diagrams.push({id:'missing-node',name:'Vista inválida',type:'custom',description:'',createdAt:'2026-01-01',nodes:[{id:'missing',elementId:'not-found',x:0,y:0}],edges:[]})
 assert.throws(()=>applyAuthorizedChange(original,draft,role()),/Elemento no encontrado/)
 assert.equal(original.diagrams.length,2)
})
test('las relaciones de una nueva vista también requieren permiso de creación',()=>{
 const original=fixture(),actor:Access={roleId:'qa',roleKey:'qa',roleName:'QA',permissions:new Set(['diagram.view.process','diagram.view.custom','diagram.create.custom','element.view.activity'])}
 const draft=projectVisible(original,actor)
 draft.diagrams.push({id:'new',name:'Nueva vista',type:'custom',description:'',createdAt:'2026-01-01',nodes:[{id:'na',elementId:'a',x:0,y:0},{id:'nb',elementId:'b',x:100,y:0}],edges:[{id:'new-edge',source:'na',target:'nb'}]})
 assert.throws(()=>applyAuthorizedChange(original,draft,actor),/relation.create.functional/)
 actor.permissions.add('relation.create.functional')
 assert.equal(applyAuthorizedChange(original,draft,actor).diagrams.find(d=>d.id==='new')?.edges[0].id,'new-edge')
})
test('crear datos técnicos requiere privilegio técnico incluso si el elemento es visible',()=>{
 const original=fixture(),actor:Access={roleId:'qa',roleKey:'qa',roleName:'QA',permissions:new Set(['diagram.view.process','element.view.activity','element.create.activity'])}
 const draft=projectVisible(original,actor),el=createElement('Nuevo paso','activity');el.technical='Secreto técnico QA';draft.elements[el.id]=el
 assert.throws(()=>applyAuthorizedChange(original,draft,actor),/No puedes crear detalles técnicos UML/)
 assert.equal(original.elements[el.id],undefined)
})


// Exercise explicit business validation, independently of API transport.
for(const [name,change,message] of [
 ['diagrama repetido',(d:ProjectDocument)=>d.diagrams.push(structuredClone(d.diagrams[0])),/IDs de diagrama duplicados/],
 ['filtro duplicado',(d:ProjectDocument)=>{d.diagrams[0].filters=[{id:'f',label:'Uno'},{id:'f',label:'Dos'}]},/Filtros de diagrama inválidos/],
 ['filtro inexistente',(d:ProjectDocument)=>{d.diagrams[0].nodes[0].filterIds=['absent']},/Nodo con filtro inexistente/],
 ['ancho inválido',(d:ProjectDocument)=>{d.diagrams[0].nodes[0].width=-1},/Dimensiones de caja inválidas/],
 ['alto inválido',(d:ProjectDocument)=>{d.diagrams[0].nodes[0].height=0},/Dimensiones de caja inválidas/],
 ['dirección inválida',(d:ProjectDocument)=>{d.diagrams[0].edges[0].direction='invalid' as never},/Dirección de relación inválida/],
 ['trazo inválido',(d:ProjectDocument)=>{d.diagrams[0].edges[0].lineStyle='invalid' as never},/Trazo de relación inválido/],
 ['recorrido inválido',(d:ProjectDocument)=>{d.diagrams[0].edges[0].pathStyle='invalid' as never},/Tipo de recorrido de relación inválido/],
 ['multiplicidad inválida',(d:ProjectDocument)=>{d.diagrams[0].edges[0].sourceMultiplicity='x'.repeat(81)},/Extremos UML inválidos/],
 ['vista inexistente',(d:ProjectDocument)=>{d.elements.a.childDiagramId='missing'},/Vista vinculada inexistente/],
 ['destino inexistente',(d:ProjectDocument)=>{d.elements.a.childDiagramId='c2';d.elements.a.childNodeId='missing'},/Caja vinculada inexistente/],
] as const){
 test('validación independiente: '+name,async()=>{
  const {ensureUniqueIds}=await import('../modules/projects/application/document-policy');const doc=fixture();change(doc);assert.throws(()=>ensureUniqueIds(doc),message)
 })
}
test('rechaza versión de esquema no soportada sin mutar documento original',()=>{
 const d=fixture(),a=role(),incoming=projectVisible(d,a),snapshot=structuredClone(d);incoming.schema=2 as never
 assert.throws(()=>applyAuthorizedChange(d,incoming,a),/Versión de documento no soportada/);assert.deepEqual(d,snapshot)
})
test('no permite sobrescribir un elemento oculto por su identidad',()=>{
 const d=fixture(),a=role('functional'),incoming=projectVisible(d,a);incoming.elements.c={...createElement('Inyección','activity'),id:'c'}
 assert.throws(()=>applyAuthorizedChange(d,incoming,a),/elemento oculto/);assert.equal(d.elements.c.name,'Backend')
})
test('el destino granular se oculta cuando su caja no es visible aunque la vista sí lo sea',()=>{
 const d=fixture();Object.assign(d.elements.a,{childDiagramId:'p',childNodeId:'nc'});const a=role('functional'),result=projectVisible(d,a)
 assert.equal(result.elements.a.childDiagramId,'p');assert.equal(result.elements.a.childNodeId,undefined);assert.equal(d.elements.a.childNodeId,'nc')
})


test('no permite borrar un elemento visible mientras sigue referenciado en otra vista',()=>{
 const doc=fixture(),actor=role(),incoming=projectVisible(doc,actor);delete incoming.elements.c;incoming.diagrams[0].nodes=incoming.diagrams[0].nodes.filter(n=>n.elementId!=='c');incoming.diagrams[1].nodes=[];const original=structuredClone(doc)
 assert.throws(()=>applyAuthorizedChange(doc,incoming,actor),/No puedes eliminar un elemento utilizado en una vista/);assert.deepEqual(doc,original)
})

test('una relación UML existente no puede convertirse a una notación inválida',()=>{
 const stored=emptyDoc();stored.elements={a:{...createElement('A','uml-class'),id:'a'},b:{...createElement('B','uml-class'),id:'b'}};stored.diagrams=[{id:'u',type:'uml-class',name:'QA',description:'',createdAt:'2026-01-01',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:300,y:0}],edges:[{id:'r',source:'a',target:'b',relationKind:'association'}]}]
 const original=structuredClone(stored),draft=projectVisible(stored,role());draft.diagrams[0].edges[0].lineStyle='dotted';assert.throws(()=>applyAuthorizedChange(stored,draft,role()),/dirección o trazo normativo/);assert.deepEqual(stored,original)
})
