import {describe,it,expect} from 'vitest'
import {renderHook} from '@testing-library/react'
import {demoDocument} from '@atlas/fixtures'
import {useGraphView} from './useGraphView'
import type {Perspective} from '@atlas/contracts'
import type {Node,Edge} from '@xyflow/react'

const doc=demoDocument()
const selected=doc.diagrams.find(d=>d.type==='process')!
describe('Adaptador de grafo para React Flow',()=>{
 it('sin diagrama no devuelve cajas ni conexiones',()=>{
  const {result}=renderHook(()=>useGraphView({doc,diagram:null,groups:[],dependencies:true,mode:'mixed',selectedId:null,canEdit:false}))
  expect(result.current.nodes).toHaveLength(0)
  expect(result.current.edges).toHaveLength(0)
 })
 it('sin documento no expone la representación',()=>{
  const {result}=renderHook(()=>useGraphView({doc:null,diagram:selected,groups:['Pagos'],dependencies:true,mode:'mixed',selectedId:null,canEdit:false}))
  expect(result.current.nodes).toEqual([])
 })
 it('nodos se seleccionan por elemento y heredan permisos de edición',()=>{
  const {result,rerender}=renderHook(({canEdit,mode}:{canEdit:boolean;mode:Perspective})=>useGraphView({doc,diagram:selected,groups:['Pagos'],dependencies:true,mode,selectedId:'execute',canEdit}),{initialProps:{canEdit:false,mode:'mixed' as 'functional'|'mixed'|'technical'}})
  const node=result.current.nodes.find((n:Node)=>n.data.elementId==='execute')
  expect(node?.selected).toBe(true)
  expect(node?.draggable).toBe(false)
  rerender({canEdit:true,mode:'technical'})
  expect(result.current.nodes.find((n:Node)=>n.data.elementId==='execute')?.draggable).toBe(true)
  expect(result.current.nodes.find((n:Node)=>n.data.elementId==='execute')?.data.mode).toBe('technical')
 })
 it('secuencias animan relaciones; otros diagramas no',()=>{
  const diagram=doc.diagrams.find(d=>d.type==='sequence')!
  const {result}=renderHook(()=>useGraphView({doc,diagram,groups:['Pagos'],dependencies:true,mode:'technical',selectedId:null,canEdit:false}))
  expect(result.current.edges.length).toBeGreaterThan(0)
  expect(result.current.edges.every((e:Edge)=>e.animated)).toBe(true)
  expect(result.current.edges[0].markerEnd).toBeDefined()
 })
})

describe('Relaciones configurables',()=>{
 it('renderiza doble flecha, puerto exacto y estilo persistido',()=>{
  const diagram=structuredClone(doc.diagrams.find(d=>d.type==='c2')!)
  const first=diagram.edges[0]
  diagram.edges[0]={...first,direction:'both',sourceHandle:'top-2',targetHandle:'bottom-3',lineStyle:'dashed',pathStyle:'bezier'}
  const {result}=renderHook(()=>useGraphView({doc,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
  const edge=result.current.edges.find(x=>x.id===first.id)!
  expect(edge.markerStart).toBeDefined();expect(edge.markerEnd).toBeDefined()
  expect(edge.sourceHandle).toBe('top-2');expect(edge.targetHandle).toBe('bottom-3')
  expect(edge.style?.strokeDasharray).toBe('7 5');expect(edge.type).toBe('bezier')
 })
})
