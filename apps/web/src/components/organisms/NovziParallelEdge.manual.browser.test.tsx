import {describe,it,expect,vi} from 'vitest'
import type {ReactNode} from 'react'
import {fireEvent,render,screen,cleanup} from '@testing-library/react'
import {afterEach} from 'vitest'
vi.mock('@xyflow/react',()=>({
 BaseEdge:({id,path}:{id:string;path:string})=><svg><path data-testid={`edge-${id}`} d={path}/></svg>,
 EdgeLabelRenderer:({children}:{children:ReactNode})=><div>{children}</div>,
 useReactFlow:()=>({screenToFlowPosition:(p:{x:number;y:number})=>p})
}))
import {NovziParallelEdge} from './NovziParallelEdge'
import type {EdgeProps} from '@xyflow/react'
afterEach(cleanup)
const props=(onRouteCommit:(id:string,route:unknown)=>void)=>({
 id:'edge-qa',sourceX:20,sourceY:40,targetX:320,targetY:40,sourcePosition:'right',targetPosition:'left',
 label:'HTTPS',data:{parallelOffset:0,parallelPath:'step',routeEditing:true,routeCanEdit:true,onRouteCommit}
}) as unknown as EdgeProps

describe('P0 / controles interactivos de recorrido',()=>{
 it('arrastrar un tramo solo confirma una escritura al soltar; origen/destino no cambian',()=>{
  const save=vi.fn()
  render(<NovziParallelEdge {...props(save)}/>)
  const drag=screen.getByRole('button',{name:/Mover tramo 1/})
  fireEvent.pointerDown(drag,{clientX:100,clientY:40})
  fireEvent.pointerMove(window,{clientX:100,clientY:95})
  fireEvent.pointerMove(window,{clientX:100,clientY:110})
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerUp(window,{clientX:100,clientY:110})
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][0]).toBe('edge-qa')
  expect(save.mock.calls[0][1].version).toBe(1)
 })
 it('añadir giro genera recorrido persistible y restablecer borra solo el ajuste',()=>{
  const save=vi.fn()
  const original=props(save)
  const {rerender}=render(<NovziParallelEdge {...original}/>)
  fireEvent.click(screen.getByRole('button',{name:'Agregar giro en la relación'}))
  expect(save).toHaveBeenCalledTimes(1)
  const manual=save.mock.calls[0][1]
  rerender(<NovziParallelEdge {...{...original,data:{...original.data,manualRoute:manual}} as EdgeProps}/>)
  fireEvent.click(screen.getByRole('button',{name:'Restablecer recorrido automático'}))
  expect(save).toHaveBeenLastCalledWith('edge-qa',undefined)
 })
})
