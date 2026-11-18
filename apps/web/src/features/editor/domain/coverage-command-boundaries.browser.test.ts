import {test} from 'vitest'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,umlAbsolutePosition} from '@atlas/contracts'
import type {ProjectDocument,Diagram} from '@atlas/contracts'
import {createDiagram,addFieldDefinition,removeFieldDefinition,deleteDiagram,setNodePackage,convertLegacyActivitySignal} from './document-commands'
import activities from '../../../../../../qa/ATLAS_QA_UML_ACTIVIDADES.json'
import usecases from '../../../../../../qa/ATLAS_QA_UML_CASOS_DE_USO.json'
const copied=(v:unknown)=>structuredClone(v) as ProjectDocument
const date='2026-11-16'

test('Campos personalizados: quitar definición no borra respuestas ni modifica la ficha compartida',()=>{
 const d=emptyDoc();const element={...createElement('Servicio','component'),id:'svc',fields:{auditCode:'X-001'}};d.elements.svc=element
 const added=addFieldDefinition(d,{id:'auditCode',label:'Código de auditoría',kind:'text',forType:'all'})
 assert.equal(added.fieldDefinitions.length,d.fieldDefinitions.length+1);assert.equal(added.fieldDefinitions.at(-1)?.id,'auditCode')
 assert.throws(()=>addFieldDefinition(added,{id:'auditCode',label:'Otra etiqueta',kind:'text',forType:'all'}),/duplicado/)
 const without=removeFieldDefinition(added,'auditCode')
 assert.deepEqual(without.fieldDefinitions,d.fieldDefinitions);assert.equal(without.elements.svc.fields?.auditCode,'X-001')
 assert.deepEqual(d.elements.svc,element);assert.deepEqual(removeFieldDefinition(without,'ausente').fieldDefinitions,d.fieldDefinitions)
})

test('Proyecto: borrar una vista desvincula drill-down sin borrar la ficha compartida ni otras vistas',()=>{
 let d=createDiagram(emptyDoc(),{id:'context',name:'Contexto',type:'c1',date})
 d=createDiagram(d,{id:'detail',name:'Detalle',type:'c4',date})
 const element={...createElement('API','component'),id:'api',childDiagramId:'detail'};d.elements.api=element
 const before=structuredClone(d)
 const unlinked=deleteDiagram(d,'detail')
 assert.equal(unlinked.diagrams.length,1);assert.equal(unlinked.diagrams[0].id,'context')
 assert.equal(unlinked.elements.api.id,'api');assert.equal(unlinked.elements.api.childDiagramId,undefined)
 assert.equal(d.elements.api.childDiagramId,'detail');assert.deepEqual(d,before)
 const removed=deleteDiagram(d,'context')
 assert.equal(removed.diagrams.length,1);assert.equal(removed.diagrams[0].id,'detail')
 assert.equal(removed.elements.api.childDiagramId,'detail');assert.deepEqual(d,before)
})

test('Contención UML de casos: impide autociclos, padres incompatibles y preserva el documento original',()=>{
 const d=copied(usecases),before=structuredClone(d),v=d.diagrams[0],original=v.nodes.find(n=>n.id==='n-book')!
 assert.throws(()=>setNodePackage(d,v.id,'n-book','n-book'),/sí mismo/)
 assert.throws(()=>setNodePackage(d,v.id,'n-book','n-a'),/incompatible/)
 assert.throws(()=>setNodePackage(d,v.id,'ausente','n-s'),/no encontrada/)
 assert.deepEqual(d,before)
 const result=setNodePackage(d,v.id,'n-book','n-s')
 assert.equal(result.diagrams[0].nodes.find(n=>n.id==='n-book')?.parentNodeId,'n-s')
 assert.equal(result.elements.book.useCaseDetail?.subjectIds?.includes('s'),true)
 assert.deepEqual(result.diagrams[0].nodes.find(n=>n.id==='n-book'),original)
})

test('Contención UML: retirar un caso de uso de su sujeto conserva coordenadas absolutas y aplicabilidad semántica',()=>{
 const d=copied(usecases),v=d.diagrams[0],n=v.nodes.find(n=>n.id==='n-book')!,original=umlAbsolutePosition(v,n)
 const detached=setNodePackage(d,v.id,'n-book')
 const next=detached.diagrams[0].nodes.find(n=>n.id==='n-book')!
 assert.equal(next.parentNodeId,undefined);assert.deepEqual(umlAbsolutePosition(detached.diagrams[0],next),original)
 assert.deepEqual(detached.elements.book.useCaseDetail?.subjectIds,d.elements.book.useCaseDetail?.subjectIds)
 assert.equal(d.diagrams[0].nodes.find(x=>x.id==='n-book')?.parentNodeId,'n-s')
})

test('Señal histórica de actividad: bloqueo de ID duplicado y conversión explícita preservan la señal del catálogo',()=>{
 const d=copied(activities),v=d.diagrams.find(x=>x.id==='convert')!,before=structuredClone(d)
 assert.throws(()=>convertLegacyActivitySignal(d,v.id,'convert-i','sendSignal','x',date),/Señal histórica/)
 const local:Diagram={...v,nodes:[...v.nodes,{id:'old-signal-node',elementId:'signal-type',x:1000,y:80}]}
 const withSignal={...d,diagrams:d.diagrams.map(view=>view.id===v.id?local:view)}
 assert.throws(()=>convertLegacyActivitySignal(withSignal,v.id,'old-signal-node','sendSignal','signal-type',date),/Señal histórica/)
 const converted=convertLegacyActivitySignal(withSignal,v.id,'old-signal-node','sendSignal','native-signal',date)
 assert.equal(converted.elements['native-signal'].type,'uml-action')
 assert.equal(converted.elements['native-signal'].activityDetail?.referenceId,'signal-type')
 assert.equal(converted.elements['signal-type'].type,'uml-signal')
 assert.equal(converted.diagrams.find(x=>x.id==='convert')?.nodes.find(n=>n.id==='native-signal')?.elementId,'native-signal')
 assert.equal(withSignal.elements['native-signal'],undefined);assert.deepEqual(d,before)
})
