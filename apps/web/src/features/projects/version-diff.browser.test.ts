import {describe,it,expect} from 'vitest'
import {emptyDoc,createElement} from '@novzi/contracts'
import {compareVersions} from './version-diff'
describe('Comparación visual de revisiones',()=>{
 it('diferencia la creación, modificación y eliminación de datos del modelo',()=>{
  const before=emptyDoc(),after=emptyDoc()
  const one=createElement('Elemento inicial','component')
  before.elements[one.id]=one
  after.elements[one.id]={...one,summary:'Revisado'}
  after.diagrams=[{id:'d1',name:'Nuevo C2',description:'',type:'c2',createdAt:'2026-01-01',nodes:[],edges:[]}]
  expect(compareVersions(before,after)).toEqual(expect.arrayContaining([
   expect.objectContaining({kind:'Elemento',action:'Modificado'}),
   expect.objectContaining({kind:'Diagrama',action:'Agregado'})
  ]))
  expect(compareVersions(after,before)).toEqual(expect.arrayContaining([expect.objectContaining({kind:'Diagrama',action:'Eliminado'})]))
 })
})
it('no reporta cambios inexistentes y diferencia campos personalizados editados y eliminados',()=>{
 const before=emptyDoc(),after=structuredClone(before)
 expect(compareVersions(before,after)).toEqual([])
 const field=after.fieldDefinitions[0];field.label='Prioridad QA';after.fieldDefinitions.pop()
 expect(compareVersions(before,after)).toEqual(expect.arrayContaining([expect.objectContaining({kind:'Campo',action:'Modificado',name:'Prioridad QA',fields:['etiqueta']}),expect.objectContaining({kind:'Campo',action:'Eliminado'})]))
})

it('identifica una modificación de propiedad sin traducción y nombres de campo eliminados',()=>{
 const before=emptyDoc(),after=structuredClone(before)
 const el=createElement('Servicio QA','service');before.elements[el.id]=el
 after.elements[el.id]={...el,group:'Pagos QA'}
 expect(compareVersions(before,after)).toContainEqual({kind:'Elemento',action:'Modificado',name:'Servicio QA',fields:['group']})
 const removed=compareVersions(after,emptyDoc())
 expect(removed).toContainEqual({kind:'Elemento',action:'Eliminado',name:'Servicio QA',fields:[]})
})
