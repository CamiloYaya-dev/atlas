import {describe,it,expect} from 'vitest'
import {emptyDoc,createElement} from '@atlas/contracts'
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
