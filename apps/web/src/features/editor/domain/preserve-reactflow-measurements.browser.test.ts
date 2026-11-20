import {describe,it,expect} from 'vitest'
import type {Node} from '@xyflow/react'
import {preserveReactFlowMeasurements} from './preserve-reactflow-measurements'

const fixture=(overrides:Partial<Node>={}):Node=>({id:'aa',type:'novzi',position:{x:12,y:30},style:{width:48,height:300},data:{graphType:'uml-sequence',mode:'mixed'},...overrides})

describe('P0 - mediciones de puertos React Flow al actualizar la vista',()=>{
 it('conserva la medición al pasar el mouse y cambiar selección, sin modificar posición ni modelo',()=>{
  const measured=fixture({measured:{width:48,height:300},selected:false})
  const next=fixture({position:{x:70,y:45},selected:true})
  const [result]=preserveReactFlowMeasurements([next],[measured],true)
  expect(result.measured).toEqual({width:48,height:300})
  expect(result.position).toEqual(next.position)
  expect(result.selected).toBe(true)
  expect(next.measured).toBeUndefined()
 })
 it('no traslada medidas de otro diagrama aunque coincidan los identificadores',()=>{
  const [result]=preserveReactFlowMeasurements([fixture()],[fixture({measured:{width:48,height:300}})],false)
  expect(result.measured).toBeUndefined()
 })
 it('recalcula cuando cambia ancho, altura o perspectiva',()=>{
  const old=fixture({measured:{width:48,height:300}})
  for(const next of [fixture({style:{width:58,height:300}}),fixture({style:{width:48,height:310}}),fixture({data:{graphType:'uml-sequence',mode:'functional'}})]){
   expect(preserveReactFlowMeasurements([next],[old],true)[0].measured).toBeUndefined()
  }
 })
 it('descarta medidas incompletas o no válidas',()=>{
  for(const measured of [{width:0,height:300},{width:48,height:0},{width:Number.NaN,height:300},{width:48}]){
   const [result]=preserveReactFlowMeasurements([fixture()],[fixture({measured})],true)
   expect(result.measured).toBeUndefined()
  }
 })
 it('respeta nodos nuevos y preserva el orden de los nuevos elementos',()=>{
  const old=fixture({measured:{width:48,height:300}})
  const other=fixture({id:'bb'})
  const list=preserveReactFlowMeasurements([other,fixture()],[old],true)
  expect(list.map(node=>node.id)).toEqual(['bb','aa'])
  expect(list[0].measured).toBeUndefined()
  expect(list[1].measured).toEqual({width:48,height:300})
 })
})
