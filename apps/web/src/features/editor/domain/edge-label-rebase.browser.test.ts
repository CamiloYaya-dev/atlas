import {describe,expect,it} from 'vitest'
import type {ProjectDocument} from '@novzi/contracts'
import {rebaseManualRoutes} from './diagram-beautify'
const make=()=>({schema:1,elements:{},fieldDefinitions:[],diagrams:[{id:'d1',name:'C3',type:'c4',nodes:[
 {id:'a',elementId:'el-a',x:0,y:0,width:100,height:80},
 {id:'b',elementId:'el-b',x:300,y:0,width:100,height:80}],
 edges:[{id:'e',source:'a',target:'b',label:'REST',labelPosition:{mode:'manual',x:200,y:-25}}]}]}) as unknown as ProjectDocument
describe('P0 etiquetas ancladas a relaciones',()=>{
 it('si se mueve una caja, la etiqueta manual acompaña proporcionalmente el recorrido',()=>{
  const before=make()
  const after=structuredClone(before)
  after.diagrams[0].nodes[1].x+=100
  const out=rebaseManualRoutes(before,after,'d1')
  expect(out.diagrams[0].edges[0].labelPosition).toEqual({mode:'manual',x:250,y:-25})
  expect(out.diagrams[0].edges[0].id).toBe('e')
 })
 it('si no cambian los extremos, no reescribe ni la etiqueta ni las relaciones',()=>{
  const doc=make()
  const out=rebaseManualRoutes(doc,doc,'d1')
  expect(out).toBe(doc)
 })
})
