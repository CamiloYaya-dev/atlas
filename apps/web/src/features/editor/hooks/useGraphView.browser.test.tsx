import {describe,it,expect} from 'vitest'
import {renderHook} from '@testing-library/react'
import {demoDocument} from '@novzi/fixtures'
import {useGraphView} from './useGraphView'
import {createElement,emptyDoc} from '@novzi/contracts'
import type {Perspective,Diagram} from '@novzi/contracts'
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
  expect(result.current.edges.every(e=>e.type==='novzi-uml')).toBe(true)
  expect(result.current.edges.every(e=>String(e.sourceHandle).startsWith('seq-'))).toBe(true)
  expect(result.current.edges.every(e=>String(e.targetHandle).startsWith('seq-'))).toBe(true)
  expect(new Set(result.current.edges.filter(e=>e.source==='aa').map(e=>e.sourceHandle)).size).toBe(3)
  expect(new Set(result.current.edges.filter(e=>e.target==='aa').map(e=>e.targetHandle)).size).toBe(3)
  expect(diagram.edges[0].sourceHandle).toBe('top-2') // No se reescribe el historial.
  expect(result.current.nodes.find(n=>n.id==='aa')?.data.sequenceActivationHeight).toBe(340)
 })
})

it('los puertos históricos de actividad llegan al único vértice y las flechas conservan la notación UML',()=>{
 const model=emptyDoc();model.elements={a:{...createElement('Inicio','uml-start'),id:'a'},b:{...createElement('Decisión','uml-decision'),id:'b'}}
 const diagram:Diagram={id:'d',type:'uml-activity',name:'Actividad',description:'',createdAt:'2026-11-14',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:200,y:180}],edges:[{id:'e',source:'a',target:'b',sourceHandle:'bottom-3',targetHandle:'top-1',relationKind:'control-flow',label:'[ok]'}]}
 model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
 expect(result.current.edges[0]).toMatchObject({sourceHandle:'bottom-2',targetHandle:'top-2',type:'novzi-uml',label:'[ok]'})
 expect(diagram.edges[0].sourceHandle).toBe('bottom-3')
})
it('destrucción anidada termina la línea de vida y no queda restringida al interior de la activación',()=>{
 const model=emptyDoc();for(const [id,type] of [['p','uml-lifeline'],['a','uml-activation'],['x','uml-destruction']] as const)model.elements[id]={...createElement(id,type),id}
 const diagram:Diagram={id:'s',type:'uml-sequence',name:'Seq',description:'',createdAt:'2026-11-14',nodes:[{id:'x',elementId:'x',parentNodeId:'a',x:0,y:176,width:48,height:48},{id:'a',elementId:'a',parentNodeId:'p',x:61,y:70,width:48,height:200},{id:'p',elementId:'p',x:10,y:10,width:170,height:400}],edges:[]};model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
 expect(result.current.nodes.map(n=>n.id)).toEqual(['p','a','x']);expect(result.current.nodes[0].data.sequenceEndY).toBe(270);expect(result.current.nodes[1].extent).toBe('parent');expect(result.current.nodes[2].extent).toBeUndefined()
})

it('C1 renderiza relaciones bidireccionales, inversas, sin flecha y paralelas sin mutar el documento',()=>{
 const model=demoDocument(),diagram=model.diagrams[0];const base=diagram.edges[0]
 diagram.edges=[{...base,id:'a',direction:'reverse',lineStyle:'dotted'},{...base,id:'b',direction:'none',label:''},{...base,id:'c',direction:'both',relationKind:'dependency'}, {...base,id:'d',relationKind:'association',direction:'both'}]
 const snapshot=structuredClone(model)
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
 const [a,b,c,d]=result.current.edges
 expect(result.current.edges.every(e=>e.type==='novzi-parallel')).toBe(true)
 expect(a.markerStart).toBeDefined();expect(a.markerEnd).toBeUndefined();expect(a.style?.strokeDasharray).toBe('2 5')
 expect(b.markerStart).toBeUndefined();expect(b.markerEnd).toBeUndefined();expect(b.label).toBe('')
 expect(c.markerStart).toBeDefined();expect(c.markerEnd).toBeDefined();expect(c.style?.strokeDasharray).toBe('7 5')
 expect(d.markerStart).toBeUndefined();expect(d.markerEnd).toBeUndefined()
 expect(model).toEqual(snapshot)
})
it('una caja cuyo padre está oculto conserva coordenadas absolutas y no referencia un padre inexistente',()=>{
 const model=emptyDoc();model.elements={p:{...createElement('Paquete','uml-package'),id:'p'},c:{...createElement('Clase','uml-class'),id:'c'}}
 const diagram:Diagram={id:'p',name:'Paquetes',type:'uml-package',description:'',createdAt:'2026-11-14',filters:[{id:'parent',label:'Padre'},{id:'child',label:'Hijo'}],nodes:[{id:'p',elementId:'p',x:50,y:100,filterIds:['parent']},{id:'c',elementId:'c',parentNodeId:'p',x:20,y:30,filterIds:['child']}],edges:[]};model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:['child'],dependencies:false,includeUntagged:false,mode:'technical',selectedId:null,canEdit:false}))
 expect(result.current.nodes).toHaveLength(1);expect(result.current.nodes[0].position).toEqual({x:70,y:130});expect(result.current.nodes[0].parentId).toBeUndefined();expect(result.current.nodes[0].draggable).toBe(false)
})
it('los mensajes de secuencia explícitos respetan el puerto disponible y degradan el puerto obsoleto sin cambiar la persistencia',()=>{
 const model=emptyDoc();for(const [id,type] of [['p','uml-lifeline'],['a','uml-activation'],['b','uml-lifeline']] as const)model.elements[id]={...createElement(id,type),id}
 const diagram:Diagram={id:'s',name:'Secuencia',type:'uml-sequence',description:'',createdAt:'2026-11-14',nodes:[{id:'p',elementId:'p',x:0,y:0,width:170,height:400},{id:'a',elementId:'a',parentNodeId:'p',x:60,y:60,width:48,height:160},{id:'b',elementId:'b',x:300,y:0,width:170,height:400}],edges:[{id:'explicit',source:'a',target:'b',sourceHandle:'seq-right-1',relationKind:'message'},{id:'old',source:'b',target:'a',targetHandle:'seq-left-999',relationKind:'reply'}]};model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
 expect(result.current.edges[0].sourceHandle).toBe('seq-right-1');expect(result.current.edges[1].targetHandle).toMatch(/^seq-left-/);expect(result.current.edges[1].targetHandle).not.toBe('seq-left-999');expect(diagram.edges[1].targetHandle).toBe('seq-left-999')
})

it('UML sin relación explícita usa notación por defecto y conserva puertos de una acción',()=>{
 const model=emptyDoc();for(const id of ['a','b'])model.elements[id]={...createElement(id,'uml-action'),id};const diagram:Diagram={id:'a',type:'uml-activity',name:'QA04',description:'',createdAt:'2026-11-14',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:200,y:100}],edges:[{id:'ab',source:'a',target:'b',sourceHandle:'top-1',targetHandle:'bottom-3'}]};model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:'b',canEdit:true}));expect(result.current.edges[0]).toMatchObject({type:'novzi-uml',sourceHandle:'top-1',targetHandle:'bottom-3'});expect(result.current.edges[0].data?.relationKind).toBe('control-flow');expect(result.current.nodes.find(n=>n.id==='b')?.selected).toBe(true);expect(diagram.edges[0].relationKind).toBeUndefined()
})

it('normaliza exclusivamente las puntas antiguas de símbolos de actividad sin alterar el modelo',()=>{
 const model=emptyDoc();model.elements={a:{...createElement('Decisión','uml-decision'),id:'a'},b:{...createElement('Final','uml-flow-final'),id:'b'}};const diagram:Diagram={id:'a',type:'uml-activity',name:'QA05',description:'',createdAt:'2026-11-14',nodes:[{id:'a',elementId:'a',x:0,y:0},{id:'b',elementId:'b',x:200,y:100}],edges:[{id:'ab',source:'a',target:'b',sourceHandle:'top-3',targetHandle:'bottom-1',relationKind:'control-flow'},{id:'ab2',source:'a',target:'b',sourceHandle:'left',targetHandle:'right',relationKind:'control-flow'}]};model.diagrams=[diagram];const before=structuredClone(model)
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}));expect(result.current.edges[0]).toMatchObject({sourceHandle:'top-2',targetHandle:'bottom-2'});expect(result.current.edges[1]).toMatchObject({sourceHandle:'left',targetHandle:'right'});expect(model).toEqual(before)
})

it('destrucción directamente unida a participante recorta su línea de vida, sin encierro en el padre',()=>{
 const model=emptyDoc();model.elements={p:{...createElement('Participante','uml-lifeline'),id:'p'},x:{...createElement('Fin','uml-destruction'),id:'x'}};const diagram:Diagram={id:'s',type:'uml-sequence',name:'Secuencia',description:'',createdAt:'2026-11-14',nodes:[{id:'p',elementId:'p',x:10,y:10,width:170,height:400},{id:'x',elementId:'x',parentNodeId:'p',x:61,y:200,width:48,height:48}],edges:[]};model.diagrams=[diagram]
 const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}));expect(result.current.nodes[0].data.sequenceEndY).toBe(224);expect(result.current.nodes[1].parentId).toBe('p');expect(result.current.nodes[1].extent).toBeUndefined()
})

it('AUD-CL-UX UML presenta información completa incluso si la perspectiva previa era funcional',()=>{const model=emptyDoc(),element=createElement('Prueba','uml-class');model.elements[element.id]=element;const diagram:Diagram={id:'classes-ux',name:'Clases',type:'uml-class',description:'',createdAt:'2026-11-16',nodes:[{id:'node',elementId:element.id,x:100,y:100}],edges:[]};model.diagrams=[diagram];const {result,rerender}=renderHook(({mode}:{mode:Perspective})=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode,selectedId:null,canEdit:true}),{initialProps:{mode:'functional' as Perspective}});expect(result.current.nodes[0].data.mode).toBe('mixed');rerender({mode:'technical'});expect(result.current.nodes[0].data.mode).toBe('mixed');expect(result.current.nodes[0].data.element).toEqual(element)})

it('destrucción y activación de borrador con Interaction se distinguen de símbolos temporales y respetan permisos',()=>{
 const model=emptyDoc();for(const [id,type] of [['p','uml-lifeline'],['a','uml-activation'],['x','uml-destruction']] as const)model.elements[id]={...createElement(id,type),id};
 const diagram:Diagram={id:'s',type:'uml-sequence',name:'Secuencia',description:'',createdAt:'2026-11-16',interaction:{id:'s',occurrences:[]},nodes:[{id:'p',elementId:'p',x:100,y:20,width:170,height:450},{id:'a',elementId:'a',parentNodeId:'p',x:61,y:90,width:48,height:120},{id:'x',elementId:'x',parentNodeId:'p',x:61,y:426,width:48,height:48}],edges:[]};model.diagrams=[diagram];
 const {result,rerender}=renderHook(({doc,canEdit}:{doc:typeof model;canEdit:boolean})=>useGraphView({doc,diagram:doc.diagrams[0],groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit}),{initialProps:{doc:model,canEdit:true}});
 const get=(id:string)=>result.current.nodes.find(n=>n.id===id)!;
 expect(get('a')).toMatchObject({position:{x:161,y:110},draggable:true,data:{sequencePositionLocked:false}});expect(get('x').data.sequencePositionLocked).toBe(false);
 const typed=structuredClone(model);typed.elements.a.sequenceDetail={lifelineId:'p',startOccurrenceId:'start',finishOccurrenceId:'finish'};typed.elements.x.sequenceDetail={lifelineId:'p',occurrenceId:'end'};typed.diagrams[0].interaction!.occurrences=[{id:'start',nodeId:'a',time:110,kind:'start'},{id:'finish',nodeId:'a',time:230,kind:'finish'},{id:'end',nodeId:'x',time:470,kind:'event'}];
 rerender({doc:typed,canEdit:true});for(const id of ['a','x'])expect(get(id)).toMatchObject({draggable:false,data:{sequencePositionLocked:true}});
 rerender({doc:model,canEdit:false});for(const id of ['a','x'])expect(get(id).draggable).toBe(false);
 expect(model.diagrams[0].interaction?.occurrences).toEqual([]);
});


describe('Tarjetas responsive por perspectiva',()=>{
 it('C1 conserva ancho y alto guardado como mínimo visual sin modificar JSON',()=>{
  const model=emptyDoc()
  const e={...createElement('Cliente','actor'),id:'cliente',summary:'Persona que consulta los servicios de Zercano.',technical:'Interactúa desde la aplicación web y móvil con la autenticación.'}
  model.elements[e.id]=e
  const diagram:Diagram={id:'c1-card',name:'Contexto',description:'',type:'c1',createdAt:'2026-11-19',nodes:[{id:'caja',elementId:e.id,x:100,y:80,width:280,height:135}],edges:[]}
  model.diagrams=[diagram]
  const before=JSON.stringify(model)
  const render=(mode:Perspective)=>renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode,selectedId:null,canEdit:true}))
  for(const mode of ['functional','technical','mixed'] as const){
   const {result,unmount}=render(mode)
   const card=result.current.nodes[0]
   expect(card.style).toMatchObject({width:280,minHeight:135})
   expect(card.style?.height).toBeUndefined()
   expect(card.data).toMatchObject({adaptiveCard:true,cardMinHeight:135,mode})
   unmount()
  }
  expect(JSON.stringify(model)).toBe(before)
 })
 it('las geometrías UML conservan una altura fija y no reciben adaptación automática',()=>{
  const model=emptyDoc()
  const e={...createElement('Cliente','uml-class'),id:'clase'}
  model.elements[e.id]=e
  const diagram:Diagram={id:'uml-card',name:'Clases',description:'',type:'uml-class',createdAt:'2026-11-19',nodes:[{id:'caja',elementId:e.id,x:50,y:50,width:280,height:180}],edges:[]}
  model.diagrams=[diagram]
  const {result}=renderHook(()=>useGraphView({doc:model,diagram,groups:[],dependencies:false,mode:'mixed',selectedId:null,canEdit:true}))
  const card=result.current.nodes[0]
  expect(card.style).toMatchObject({width:280,height:180})
  expect(card.data.adaptiveCard).toBe(false)
 })
})
