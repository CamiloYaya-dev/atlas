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

describe('UML Secuencia — regresión de mensajes paralelos',()=>{
 it('seis mensajes entre dos ejecuciones se distribuyen en distintos anclajes laterales, sin sobrescribir JSON',()=>{
  const model=structuredClone(doc)
  const element=(id:string,type:'uml-lifeline'|'uml-activation')=>({
   ...structuredClone(Object.values(doc.elements)[0]),id,name:id,type
  })
  model.elements['participant-a']=element('participant-a','uml-lifeline')
  model.elements['participant-b']=element('participant-b','uml-lifeline')
  model.elements['activation-a']=element('activation-a','uml-activation')
  model.elements['activation-b']=element('activation-b','uml-activation')
  const diagram={
   id:'test-sequence',type:'uml-sequence' as const,name:'Mensajes múltiples',description:'',createdAt:'2026-11-14',
   nodes:[
    {id:'pa',elementId:'participant-a',x:50,y:80,width:170,height:500},
    {id:'pb',elementId:'participant-b',x:420,y:80,width:170,height:500},
    {id:'aa',elementId:'activation-a',x:61,y:80,width:48,height:340,parentNodeId:'pa'},
    {id:'ab',elementId:'activation-b',x:61,y:80,width:48,height:340,parentNodeId:'pb'},
   ],
   edges:Array.from({length:6},(_,i)=>({
    id:`edge-${i}`,source:i%2===0?'aa':'ab',target:i%2===0?'ab':'aa',
    sourceHandle:i===0?'top-2':i%2===0?'right':'left',
    targetHandle:i%2===0?'left':'right',relationKind:i%2===0?'message':'reply',label:`mensaje ${i}`
   }))
  }
  model.diagrams=[diagram]
  const input={doc:model,diagram,groups:[],dependencies:false,mode:'technical' as const,selectedId:null,canEdit:true}
  const {result}=renderHook(()=>useGraphView(input))
  expect(result.current.edges).toHaveLength(6)
  expect(result.current.edges.every(e=>e.type==='atlas-uml')).toBe(true)
  expect(result.current.edges.every(e=>String(e.sourceHandle).startsWith('seq-'))).toBe(true)
  expect(result.current.edges.every(e=>String(e.targetHandle).startsWith('seq-'))).toBe(true)
  expect(new Set(result.current.edges.filter(e=>e.source==='aa').map(e=>e.sourceHandle)).size).toBe(3)
  expect(new Set(result.current.edges.filter(e=>e.target==='aa').map(e=>e.targetHandle)).size).toBe(3)
  expect(diagram.edges[0].sourceHandle).toBe('top-2') // No se reescribe el historial.
  expect(result.current.nodes.find(n=>n.id==='aa')?.data.sequenceActivationHeight).toBe(340)
 })
})
