import {afterEach,describe,expect,it,vi} from 'vitest'
import type {ReactNode} from 'react'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
vi.mock('@xyflow/react',()=>({
 BaseEdge:({id,path}:{id:string;path:string})=><svg><path data-testid={`edge-${id}`} d={path}/></svg>,
 EdgeLabelRenderer:({children}:{children:ReactNode})=><div>{children}</div>,
 useReactFlow:()=>({screenToFlowPosition:(p:{x:number;y:number})=>p})
}))
import {NovziParallelEdge} from './NovziParallelEdge'
import type {EdgeProps} from '@xyflow/react'
afterEach(cleanup)
// jsdom does not consistently implement PointerEvent coordinates. A MouseEvent
// dispatched with a pointer* type preserves real clientX/clientY for the
// component's native window pointer listeners and React's onPointerDown.
const pointerWithCoordinates=(target:Element|Window,type:'pointerdown'|'pointermove'|'pointerup',clientX:number,clientY:number)=>{
 fireEvent(target,new MouseEvent(type,{bubbles:true,cancelable:true,clientX,clientY}))
}
const make=(onRouteCommit=vi.fn(),onLabelCommit=vi.fn(),extra:Record<string,unknown>={})=>({
 id:'e-1',source:'a',target:'b',sourceX:20,sourceY:40,targetX:320,targetY:140,
 sourcePosition:'right',targetPosition:'left',label:'HTTPS / REST',
 data:{parallelOffset:0,parallelPath:'step',routeEditing:true,routeCanEdit:true,onRouteCommit,onLabelCommit,...extra}
}) as unknown as EdgeProps

describe('Editor v3 de relaciones',()=>{
 it('la etiqueta se mueve visualmente y confirma una sola actualización al soltar',()=>{
  const route=vi.fn(),save=vi.fn()
  render(<NovziParallelEdge {...make(route,save)}/>)
  const label=screen.getByRole('button',{name:'Mover nombre o protocolo: HTTPS / REST'})
  const before=label.style.transform
  pointerWithCoordinates(label,'pointerdown',160,80)
  pointerWithCoordinates(window,'pointermove',180,100)
  pointerWithCoordinates(window,'pointermove',190,110)
  expect(label.style.transform).not.toBe(before) // Preview, before persisting
  expect(save).not.toHaveBeenCalled()
  pointerWithCoordinates(window,'pointerup',190,110)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][0]).toBe('e-1')
  expect(save.mock.calls[0][1]).toMatchObject({mode:'manual'})
  expect(route).not.toHaveBeenCalled()
 })
 it('la etiqueta conserva posición manual y permite volver a la posición automática',()=>{
  const save=vi.fn()
  render(<NovziParallelEdge {...make(vi.fn(),save,{labelPosition:{mode:'manual',x:215,y:190}})}/>)
  const label=screen.getByRole('button',{name:'Mover nombre o protocolo: HTTPS / REST'})
  expect(label.style.transform).toMatch(/translate\(215px,\s*190px\)/)
  fireEvent.click(screen.getByRole('button',{name:'Restablecer posición del nombre o protocolo'}))
  expect(save).toHaveBeenCalledWith('e-1',undefined)
 })
 it('quitar giro y simplificar sólo actualizan el recorrido de su relación',()=>{
  const route=vi.fn(),saveLabel=vi.fn()
  render(<NovziParallelEdge {...make(route,saveLabel,{manualRoute:{version:1,points:[{x:90,y:40},{x:90,y:90},{x:230,y:90},{x:230,y:140}]}})}/>)
  fireEvent.click(screen.getByRole('button',{name:'Eliminar giro 2'}))
  expect(route).toHaveBeenCalledTimes(1)
  expect(route.mock.calls[0][0]).toBe('e-1')
  fireEvent.click(screen.getByRole('button',{name:'Simplificar recorrido'}))
  expect(route).toHaveBeenCalledTimes(2)
  expect(saveLabel).not.toHaveBeenCalled()
 })
 it('puertos y conectores se mantienen al mover el primer tramo',()=>{
  const save=vi.fn()
  render(<NovziParallelEdge {...make(save)}/>)
  const drag=screen.getByRole('button',{name:'Mover tramo 1'})
  fireEvent.pointerDown(drag,{clientX:50,clientY:40})
  fireEvent.pointerMove(window,{clientX:50,clientY:85})
  expect(save).not.toHaveBeenCalled()
  fireEvent.pointerUp(window,{clientX:50,clientY:85})
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][1].version).toBe(1)
 })
})
