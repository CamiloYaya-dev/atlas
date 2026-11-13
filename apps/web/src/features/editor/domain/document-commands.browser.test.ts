import {test} from 'vitest'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,diagramLabels,elementLabels,fieldLabels} from '@atlas/contracts'
import type {DiagramEdge} from '@atlas/contracts'
import {createDiagram,editDiagram,deleteDiagram,addElementNode,reuseElementNode,removeElementNode,connectNodes,editRelation,removeRelation,moveNode,editElement,addFieldDefinition,removeFieldDefinition} from './document-commands'
function fixture(){
 const a=createElement('Iniciar sesión','activity'),b=createElement('Verificar credenciales','activity')
 a.id='auth';b.id='verify'
 let d=createDiagram(emptyDoc(),{id:'d1',name:'Autenticación',type:'process',date:'2026-01-01'})
 d=addElementNode(d,'d1',a,{id:'n1',x:10,y:20})
 d=addElementNode(d,'d1',b,{id:'n2',x:100,y:20})
 return d
}
test('catálogos de vistas, elementos y campos disponibles',()=>{
 for(const key of ['c1','c2','c3','c4','process','sequence','data','trace','custom'])assert.ok(key in diagramLabels)
 for(const key of ['container','component','activity','requirement','endpoint','usecase'])assert.ok(key in elementLabels)
 for(const key of ['text','textarea','url','date','number','select','boolean'])assert.ok(key in fieldLabels)
})
test('crear y renombrar diagramas C1/C2/C3/C4/procesos/secuencias/datos/trazabilidad',()=>{
 let d=emptyDoc()
 for(const [i,type] of Object.keys(diagramLabels).entries())d=createDiagram(d,{id:`id${i}`,name:`Vista ${i}`,type:type as keyof typeof diagramLabels,date:'2026-01-01'})
 assert.equal(d.diagrams.length,Object.keys(diagramLabels).length)
 d=editDiagram(d,'id0',{name:'Contexto',description:'Visión ejecutiva'})
 assert.equal(d.diagrams[0].name,'Contexto');assert.equal(d.diagrams[0].description,'Visión ejecutiva')
})
test('no acepta nombre inválido, ID repetido ni edición de vista inexistente',()=>{
 assert.throws(()=>createDiagram(emptyDoc(),{id:'1',name:' ',type:'c1',date:'2026-01-01'}),/Nombre/)
 assert.throws(()=>createDiagram(fixture(),{id:'d1',name:'Otro',type:'c2',date:'2026-01-01'}),/duplicado/)
 assert.throws(()=>editDiagram(fixture(),'missing',{name:'x'}),/no encontrado/)
})
test('agregar cajas nuevas y reutilizarlas en varias vistas sin duplicar elemento',()=>{
 let d=fixture();d=createDiagram(d,{id:'d2',name:'Arquitectura',type:'c2',date:'2026-01-01'})
 d=reuseElementNode(d,'d2','auth',{id:'node-reused',x:0,y:0})
 assert.equal(Object.keys(d.elements).length,2)
 assert.equal(d.diagrams[1].nodes[0].elementId,'auth')
 assert.throws(()=>reuseElementNode(d,'d2','unknown',{id:'a',x:0,y:0}),/inexistente/)
 assert.throws(()=>reuseElementNode(d,'d2','auth',{id:'node-reused',x:0,y:0}),/duplicado/)
})
test('conectar, modificar nodos y eliminar caja conserva catálogo y elimina relaciones incidentes',()=>{
 let d=fixture()
 d=connectNodes(d,'d1',{id:'r1',source:'n1',target:'n2',label:'continúa'})
 assert.equal(d.diagrams[0].edges.length,1)
 d=moveNode(d,'d1','n1',41.5,92.3)
 assert.deepEqual([d.diagrams[0].nodes[0].x,d.diagrams[0].nodes[0].y],[42,92])
 d=removeElementNode(d,'d1','auth')
 assert.equal(d.diagrams[0].nodes.length,1)
 assert.equal(d.diagrams[0].edges.length,0)
 assert.ok(d.elements.auth,'el elemento no se borra al retirarlo de una vista')
})
test('relaciones paralelas tienen identidades propias; autoconexiones y extremos huérfanos se rechazan',()=>{
 const d=fixture(),e:DiagramEdge={id:'r1',source:'n1',target:'n2'}
 assert.throws(()=>connectNodes(d,'d1',{id:'r0',source:'n1',target:'n1'}),/Autoconexión/)
 assert.throws(()=>connectNodes(d,'d1',{id:'r0',source:'n1',target:'missing'}),/inexistentes/)
 const x=connectNodes(d,'d1',e)
 assert.throws(()=>connectNodes(x,'d1',e),/duplicad/)
 const two=connectNodes(x,'d1',{...e,id:'r2',sourceHandle:'top-1',targetHandle:'bottom-3'})
 const three=connectNodes(two,'d1',{...e,id:'r3',source:'n2',target:'n1'})
 assert.equal(three.diagrams[0].edges.length,3)
})
test('validación de movimiento y eliminación de diagramas referenciados',()=>{
 let d=fixture()
 assert.throws(()=>moveNode(d,'d1','n1',Number.NaN,10),/inválida/)
 assert.throws(()=>moveNode(d,'d1','missing',10,10),/no encontrado/)
 d=editElement(d,'auth',{childDiagramId:'d1'},'2026-02-03')
 d=deleteDiagram(d,'d1')
 assert.equal(d.diagrams.length,0)
 assert.equal(d.elements.auth.childDiagramId,undefined)
 assert.ok(d.elements.auth)
})
test('editar resumen, estado, responsable, fechas y enlaces sin mutar objeto anterior',()=>{
 const d=fixture(),link={id:'link1',label:'Jira',url:'https://jira.example/ISS-1'}
 const x=editElement(d,'auth',{summary:'Ingreso seguro',description:'Validar sesión',owner:'Analista',status:'En revisión',links:[link],fields:{severity:'Alta'}},'2026-11-11')
 assert.equal(x.elements.auth.summary,'Ingreso seguro')
 assert.equal(x.elements.auth.owner,'Analista')
 assert.deepEqual(x.elements.auth.links,[link])
 assert.equal(x.elements.auth.fields.severity,'Alta')
 assert.equal(x.elements.auth.updatedAt,'2026-11-11')
 assert.notEqual(x.elements.auth,d.elements.auth)
 assert.equal(d.elements.auth.summary,'')
 assert.throws(()=>editElement(d,'missing',{name:'x'},'2026-01-01'),/no encontrado/)
 assert.throws(()=>editElement(d,'auth',{id:'otro'},'2026-01-01'),/identidad/)
})
test('campos personalizados configurables y eliminables sin borrar datos de cajas',()=>{
 let d=fixture(),f={id:'jira-url',label:'Enlace Jira',forType:'requirement' as const,kind:'url' as const}
 d=addFieldDefinition(d,f)
 assert.ok(d.fieldDefinitions.some(x=>x.id==='jira-url'))
 assert.throws(()=>addFieldDefinition(d,f),/duplicado/)
 assert.throws(()=>addFieldDefinition(d,{...f,id:'bad',label:''}),/Etiqueta/)
 d=removeFieldDefinition(d,'jira-url')
 assert.equal(d.fieldDefinitions.some(x=>x.id==='jira-url'),false)
 assert.ok(d.elements.auth)
})
test('borrar una vista deja intactas las otras vistas y los elementos compartidos',()=>{
 let d=fixture();d=createDiagram(d,{id:'second',name:'Segunda',type:'custom',date:'2026-01-01'})
 d=reuseElementNode(d,'second','auth',{id:'reuse',x:5,y:5})
 d=deleteDiagram(d,'d1')
 assert.equal(d.diagrams.length,1)
 assert.equal(d.diagrams[0].nodes[0].elementId,'auth')
 assert.equal(Object.keys(d.elements).length,2)
})

test('relación: editar dirección, puertos y tipo de línea no cambia los extremos',()=>{
 let d=fixture();d=connectNodes(d,'d1',{id:'link1',source:'n1',target:'n2'})
 d=editRelation(d,'d1','link1',{direction:'both',lineStyle:'dotted',pathStyle:'straight',sourceHandle:'top-1',targetHandle:'bottom-3'})
 const edge=d.diagrams[0].edges[0]
 assert.equal(edge.direction,'both');assert.equal(edge.lineStyle,'dotted');assert.equal(edge.pathStyle,'straight');assert.equal(edge.sourceHandle,'top-1');assert.equal(edge.targetHandle,'bottom-3');assert.equal(edge.source,'n1');assert.equal(edge.target,'n2')
 assert.throws(()=>editRelation(d,'d1','link1',{source:'n2'}),/extremos/)
})
test('eliminar solo la relación respeta nodos y conserva la ficha original',()=>{
 let d=fixture();d=connectNodes(d,'d1',{id:'link1',source:'n1',target:'n2'})
 d=removeRelation(d,'d1','link1')
 assert.equal(d.diagrams[0].edges.length,0);assert.equal(d.diagrams[0].nodes.length,2)
 assert.ok(d.elements.auth);assert.ok(d.elements.verify)
 assert.throws(()=>removeRelation(d,'d1','link1'),/inexistente/)
})
test('desvincular una caja de destino conserva el diagrama general',()=>{
 let d=fixture();d=editElement(d,'auth',{childDiagramId:'d1',childNodeId:'n2'},'2026-11-12')
 d=removeElementNode(d,'d1','verify')
 assert.equal(d.elements.auth.childDiagramId,'d1')
 assert.equal(d.elements.auth.childNodeId,undefined)
})

test('dos relaciones del mismo par mantienen identidad, estilo y puerto independientes',()=>{
 let d=fixture()
 d=connectNodes(d,'d1',{id:'a',source:'n1',target:'n2',sourceHandle:'right',targetHandle:'left',label:'HTTPS'})
 d=connectNodes(d,'d1',{id:'b',source:'n1',target:'n2',sourceHandle:'top-2',targetHandle:'bottom-3',label:'Evento'})
 assert.equal(d.diagrams[0].edges.length,2)
 d=removeRelation(d,'d1','a')
 assert.equal(d.diagrams[0].edges.length,1)
 assert.equal(d.diagrams[0].edges[0].sourceHandle,'top-2')
 assert.equal(d.diagrams[0].edges[0].label,'Evento')
})
