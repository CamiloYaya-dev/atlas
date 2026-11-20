import {describe,it,expect} from 'vitest'
import {emptyDoc,createElement,isProjectDocument} from '@novzi/contracts'
import {createStandaloneDiagramDocument} from './standalone-diagram-export'

const fixture=()=>{
 const doc=emptyDoc()
 doc.elements.client={...createElement('Cliente','actor'),id:'client',childDiagramId:'other',childNodeId:'n-other'}
 doc.elements.platform={...createElement('Plataforma','system'),id:'platform'}
 doc.elements.secret={...createElement('Información de otra vista','requirement'),id:'secret',description:'No debe filtrarse'}
 doc.diagrams=[
  {id:'c1',type:'c1',name:'Contexto',createdAt:'2026-11-20',description:'',nodes:[{id:'n1',elementId:'client',x:0,y:0},{id:'n2',elementId:'platform',x:400,y:0}],edges:[{id:'edge-1',source:'n1',target:'n2',label:'Utiliza'}]},
  {id:'other',type:'process',name:'Vista privada',createdAt:'2026-11-20',description:'',nodes:[{id:'n-other',elementId:'secret',x:0,y:0}],edges:[]}
 ]
 return doc
}

describe('Exportar solo diagrama actual',()=>{
 it('incluye un solo diagrama, sus cajas y relaciones, sin fichas de otras vistas',()=>{
  const original=fixture(),snapshot=structuredClone(original)
  const exported=createStandaloneDiagramDocument(original,'c1')
  expect(exported.diagrams.map(d=>d.id)).toEqual(['c1'])
  expect(Object.keys(exported.elements).sort()).toEqual(['client','platform'])
  expect(exported.diagrams[0].edges).toEqual(original.diagrams[0].edges)
  expect(exported.elements.client.childDiagramId).toBeUndefined()
  expect(exported.elements.client.childNodeId).toBeUndefined()
  expect(isProjectDocument(exported)).toBe(true)
  expect(original).toEqual(snapshot)
 })
 it('conserva campos compatibles y excluye definiciones ajenas',()=>{
  const original=fixture()
  original.fieldDefinitions.push({id:'actor-field',label:'Tipo',forType:'actor',kind:'text'})
  original.fieldDefinitions.push({id:'secret-field',label:'Secreto',forType:'requirement',kind:'text'})
  const exported=createStandaloneDiagramDocument(original,'c1')
  expect(exported.fieldDefinitions.some(f=>f.id==='actor-field')).toBe(true)
  expect(exported.fieldDefinitions.some(f=>f.id==='secret-field')).toBe(false)
 })
 it('rechaza exportar un diagrama inexistente en lugar de enviar el proyecto',()=>{
  expect(()=>createStandaloneDiagramDocument(fixture(),'unknown')).toThrow('no existe')
 })
})
