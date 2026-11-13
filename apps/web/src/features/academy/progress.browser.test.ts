import {describe,it,expect} from 'vitest'
import type {Diagram,ElementType,ProjectDocument} from '@atlas/contracts'
import {assessAcademy,academyStorageKey,readAcademyLab,storeAcademyLab} from './progress'

function fixture():ProjectDocument{
 const doc:ProjectDocument={schema:1,elements:{},diagrams:[],fieldDefinitions:[]}
 const addElement=(id:string,type:ElementType,name=id,technical='')=>{
  doc.elements[id]={id,type,name,technical,summary:'',description:'',owner:'',author:'ATLAS',status:'Borrador',createdAt:'2026-11-12',updatedAt:'2026-11-12',links:[],fields:{}}
 }
 const addDiagram=(id:string,type:Diagram['type'],elementIds:string[],edges:[number,number][]=[]):Diagram=>{
  const diagram:Diagram={id,type,name:id,description:'',createdAt:'2026-11-12',nodes:elementIds.map((elementId,i)=>({id:`${id}-n${i}`,elementId,x:100*i,y:0})),edges:edges.map(([source,target],i)=>({id:`${id}-e${i}`,source:`${id}-n${source}`,target:`${id}-n${target}`}))}
  doc.diagrams.push(diagram);return diagram
 }
 for(const [id,type,name,technical] of [
  ['actor','actor','Persona solicitante',''],['system','system','Plataforma de solicitudes',''],['process','process','Gestionar solicitud',''],
  ['activity1','activity','Registrar solicitud',''],['activity2','activity','Revisar solicitud',''],
  ['hu','requirement','HU-01 · Registrar solicitudes',''],['rf','requirement','RF-01 · Validar campos',''],['uc','usecase','CU-01 · Registrar solicitud',''],
  ['web','container','Aplicación web',''],['api','service','API de solicitudes',''],['db','database','Base de datos',''],
  ['component','component','Gestor de solicitudes','Fastify + PostgreSQL'],['endpoint','endpoint','POST /solicitudes',''],['controller','component','SolicitudController','Controller TypeScript'],['service-class','component','SolicitudService','Servicio de dominio']
 ] as [string,ElementType,string,string][])addElement(id,type,name,technical)
 addDiagram('c1','c1',['actor','system','process'],[[0,1],[1,2]])
 addDiagram('process-diagram','process',['activity1','activity2','hu'],[[0,1]])
 addDiagram('trace','trace',['hu','rf','uc','component'],[[0,2],[1,2],[0,3]])
 addDiagram('c2','c2',['web','api','db'],[[0,1],[1,2]])
 addDiagram('c3','c3',['component','endpoint'],[[0,1]])
 addDiagram('c4','c4',['controller','service-class'],[[0,1]])
 doc.elements.process.childDiagramId='process-diagram'
 doc.elements.system.childDiagramId='c2'
 doc.elements.api.childDiagramId='c3'
 doc.elements.component.childDiagramId='c4'
 // Two distinct, user-created field definitions; seeded fields do not earn badges.
 doc.fieldDefinitions.push({id:'training-channel',label:'Canal de solicitud',forType:'requirement',kind:'select',options:['Web','Móvil','API']})
 doc.fieldDefinitions.push({id:'training-protocol',label:'Protocolo de integración',forType:'endpoint',kind:'text'})
 Object.assign(doc.elements.hu,{summary:'Un usuario registra una solicitud',description:'El sistema valida los datos y permite guardar.',owner:'Producto',fields:{'training-channel':'Web'}})
 Object.assign(doc.elements.endpoint,{summary:'Crear solicitudes',description:'Recibe y valida el cuerpo JSON de la solicitud.',owner:'Backend',technical:'HTTPS POST /solicitudes',fields:{'training-protocol':'HTTPS'}})
 return doc
}

describe('Academia de misiones: aprendizaje acreditado por datos reales',()=>{
 it('no concede insignias a un documento vacío',()=>{
  const result=assessAcademy({schema:1,diagrams:[],elements:{},fieldDefinitions:[]},true,'mixed','')
  expect([result.functionalBadge,result.technicalBadge,result.integrationBadge]).toEqual([false,false,false])
 })
 it('requiere relaciones y un mismo ID reutilizado, no solo diagramas con nombres',()=>{
  const doc=fixture();doc.diagrams.find(d=>d.type==='trace')!.edges=[]
  expect(assessAcademy(doc,true,'functional','').functionalBadge).toBe(false)
  doc.diagrams.find(d=>d.type==='trace')!.edges.push({id:'edge',source:'trace-n0',target:'trace-n2'})
  expect(assessAcademy(doc,true,'functional','').functionalBadge).toBe(false)
  doc.diagrams.find(d=>d.type==='trace')!.edges.push({id:'edge2',source:'trace-n1',target:'trace-n2'})
  expect(assessAcademy(doc,true,'functional','').functionalBadge).toBe(true)
  doc.diagrams.find(d=>d.type==='process')!.nodes=doc.diagrams.find(d=>d.type==='process')!.nodes.filter(n=>n.elementId!=='hu')
  expect(assessAcademy(doc,true,'functional','').functionalBadge).toBe(false)
 })
 it('la insignia técnica requiere vínculos C1→C2→C3→C4 y trazabilidad funcional/técnica',()=>{
  const doc=fixture();let result=assessAcademy(doc,true,'technical','c3')
  expect(result.functionalBadge).toBe(true);expect(result.technicalBadge).toBe(true)
  expect(result.integrationBadge).toBe(false)
  doc.elements.api.childDiagramId=undefined
  result=assessAcademy(doc,true,'technical','c3')
  expect(result.functionalBadge).toBe(true);expect(result.technicalBadge).toBe(false)
 })
 it('obliga a usar el Inspector para completar la HU y el endpoint con datos reales',()=>{
  const doc=fixture()
  expect(assessAcademy(doc,true,'mixed','trace').integrationBadge).toBe(true)
  doc.elements.hu.description=''
  expect(assessAcademy(doc,true,'mixed','trace').functionalBadge).toBe(false)
  doc.elements.hu.description='El sistema valida los datos'
  doc.elements.endpoint.technical=''
  expect(assessAcademy(doc,true,'mixed','trace').technicalBadge).toBe(false)
 })
 it('exige crear campos específicos y usarlos en la ficha; no bastan las definiciones',()=>{
  const doc=fixture()
  delete doc.elements.hu.fields['training-channel']
  expect(assessAcademy(doc,true,'mixed','trace').functionalBadge).toBe(false)
  doc.elements.hu.fields['training-channel']='Web'
  doc.fieldDefinitions.find(f=>f.id==='training-channel')!.forType='all'
  expect(assessAcademy(doc,true,'mixed','trace').functionalBadge).toBe(false)
  doc.fieldDefinitions.find(f=>f.id==='training-channel')!.forType='requirement'
  doc.elements.endpoint.fields['training-protocol']='FTP'
  expect(assessAcademy(doc,true,'mixed','trace').technicalBadge).toBe(false)
  doc.elements.endpoint.fields['training-protocol']='HTTPS'
  expect(assessAcademy(doc,true,'mixed','trace').technicalBadge).toBe(true)
 })
 it('la tercera insignia emerge del mismo modelo al abrir trazabilidad en perspectiva mixta',()=>{
  const doc=fixture()
  expect(assessAcademy(doc,true,'functional','trace').integrationBadge).toBe(false)
  expect(assessAcademy(doc,true,'mixed','c1').integrationBadge).toBe(false)
  const result=assessAcademy(doc,true,'mixed','trace')
  expect([result.functionalBadge,result.technicalBadge,result.integrationBadge]).toEqual([true,true,true])
 })
 it('no acredita cambios que aún no fueron confirmados por el backend',()=>{
  const doc=fixture(),result=assessAcademy(doc,false,'mixed','trace')
  expect([result.functionalBadge,result.technicalBadge,result.integrationBadge]).toEqual([false,false,false])
 })
 it('almacena la identidad del laboratorio por cuenta y no confunde espacios',()=>{
  const user='atlas-academy-unit-user'
  storeAcademyLab(user,{workspaceId:'w-1',projectId:'p-1'})
  expect(readAcademyLab(user)).toEqual({workspaceId:'w-1',projectId:'p-1'})
  expect(readAcademyLab('otra-cuenta')).toBeNull()
  window.localStorage.removeItem(academyStorageKey(user))
 })
})

describe('Conexiones del curso: flecha visual independiente de la acreditación',()=>{
 it('acepta C2 aunque se haya arrastrado desde los puertos en sentido opuesto',()=>{
  const doc=fixture();const c2=doc.diagrams.find(d=>d.type==='c2')!
  c2.edges=[{id:'rev1',source:'c2-n1',target:'c2-n0',direction:'both'},{id:'rev2',source:'c2-n2',target:'c2-n1',sourceHandle:'top-2',targetHandle:'bottom-3'}]
  const result=assessAcademy(doc,true,'technical','c2')
  expect(result.technical[0].done).toBe(true)
 })
 it('no convalida un diagrama sin conexión API ↔ base de datos',()=>{
  const doc=fixture();const c2=doc.diagrams.find(d=>d.type==='c2')!
  c2.edges=[{id:'x',source:'c2-n0',target:'c2-n1'},{id:'y',source:'c2-n2',target:'c2-n0'}]
  expect(assessAcademy(doc,true,'technical','c2').technical[0].done).toBe(false)
 })
})
