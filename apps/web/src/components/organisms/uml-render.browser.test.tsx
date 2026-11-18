import {render,screen,fireEvent} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import type {ReactNode,CSSProperties} from 'react'
import type {NodeProps,EdgeProps} from '@xyflow/react'
import {createElement,sequenceActivationPorts,UML_DIAGRAMS,UML_ELEMENTS_BY_DIAGRAM} from '@atlas/contracts'
import type {DiagramType,ElementType,ModelElement,UmlTerminal} from '@atlas/contracts'
import {AtlasNode} from './AtlasNode'
import {AtlasUmlEdge,Terminal,terminalAngle,umlRelationAdornment} from './AtlasUmlEdge'
import {AtlasParallelEdge} from './AtlasParallelEdge'
const {updated}=vi.hoisted(()=>({updated:vi.fn()}))
// Only the React Flow infrastructure is replaced: real ATLAS renderers, SVG,
// geometry, contracts and events are exercised. Browser drag tests are separate.
vi.mock('@xyflow/react',()=>({
 Position:{Left:'left',Right:'right',Top:'top',Bottom:'bottom'},
 Handle:({id,position,style}:{id:string;position:string;style?:CSSProperties})=><span data-port={id} data-side={position} style={style}/>,
 NodeResizer:({onResizeEnd}:{onResizeEnd:(event:unknown,size:{width:number;height:number;x:number;y:number})=>void})=><button onClick={()=>onResizeEnd(null,{width:180.2,height:240.7,x:13,y:20})}>QA resize</button>,
 useUpdateNodeInternals:()=>updated,
 BaseEdge:({id,path,style,markerStart,markerEnd}:{id:string;path:string;style:CSSProperties;markerStart?:string;markerEnd?:string})=><path data-testid={`edge-${id}`} d={path} style={style} markerStart={markerStart} markerEnd={markerEnd}/>,
 EdgeLabelRenderer:({children}:{children:ReactNode})=><foreignObject>{children}</foreignObject>
}))
const node=(type:ElementType,graphType:DiagramType,extra:Partial<ModelElement>={},data:Record<string,unknown>={},selected=false)=>({id:'node',type:'atlas',selected,data:{element:{...createElement('Elemento QA',type),...extra},graphType,mode:'mixed',...data}} as unknown as NodeProps)
const edge=(data:Record<string,unknown>={},label?:string)=>({id:'r',source:'a',target:'b',sourceX:10,sourceY:20,targetX:210,targetY:20,sourcePosition:'right',targetPosition:'left',data,label} as unknown as EdgeProps)
const symbols:[DiagramType,ElementType,string,number][]=[
 ['uml-activity','uml-start','circle',4],['uml-activity','uml-end','circle',4],['uml-activity','uml-flow-final','path',4],['uml-activity','uml-decision','polygon',4],['uml-activity','uml-fork','rect',8],
 ['uml-state','uml-start','circle',4],['uml-state','uml-end','circle',4],['uml-state','uml-decision','polygon',4],['uml-state','uml-fork','rect',8],['uml-state','uml-history-shallow','text',4],['uml-state','uml-history-deep','text',4],['uml-state','uml-entry-point','circle',4],['uml-state','uml-exit-point','path',4],['uml-state','uml-terminate','path',4],['uml-sequence','uml-destruction','path',4]
]
for(const [diagram,kind,shape,ports] of symbols)it(`${diagram}: ${kind} usa símbolo SVG único y ${ports} conectores`,()=>{
 const {container}=render(<AtlasNode {...node(kind,diagram)}/>);const symbol=container.querySelector('.atlas-uml-control')!
 expect(symbol).toBeTruthy();expect(container.querySelector('.atlas-node')).toBeNull();expect(symbol.querySelectorAll('svg')).toHaveLength(1);expect(symbol.querySelector(`svg ${shape}`)).toBeTruthy();expect(symbol.querySelectorAll('[data-port]')).toHaveLength(ports)
 if(kind==='uml-history-shallow')expect(symbol.querySelector('text')?.textContent).toBe('H')
 if(kind==='uml-history-deep')expect(symbol.querySelector('svg')?.textContent).toBe('H*')
 if(kind==='uml-decision')expect(symbol.querySelectorAll('polygon')).toHaveLength(1)
})
it('activación gana conectores laterales al crecer y recalcula geometría de React Flow',()=>{
 const {container,rerender}=render(<AtlasNode {...node('uml-activation','uml-sequence',{}, {sequenceActivationHeight:120})}/>);const short=container.querySelectorAll('[data-port]').length
 rerender(<AtlasNode {...node('uml-activation','uml-sequence',{}, {sequenceActivationHeight:420})}/>);
 const ports=[...container.querySelectorAll('[data-port]')];expect(ports.length).toBeGreaterThan(short);expect(ports.length).toBe(sequenceActivationPorts(420).length+2);expect(ports.every(p=>['left','right'].includes(p.getAttribute('data-side')||''))).toBe(true);expect(new Set(ports.map(p=>p.getAttribute('data-port'))).size).toBe(ports.length);expect(updated).toHaveBeenCalledWith('node')
})
it('resize de una figura y de una caja se comunica con el editor; lector no tiene control',()=>{
 const resize=vi.fn();const {rerender}=render(<AtlasNode {...node('uml-decision','uml-state',{}, {canResize:true,onResize:resize},true)}/>);fireEvent.click(screen.getByText('QA resize'));expect(resize).toHaveBeenLastCalledWith('node',180,241,13,20)
 rerender(<AtlasNode {...node('component','c3',{}, {canResize:true,onResize:resize},true)}/>);fireEvent.click(screen.getByText('QA resize'));expect(resize).toHaveBeenCalledTimes(2)
 rerender(<AtlasNode {...node('uml-decision','uml-state',{}, {canResize:false,onResize:resize},true)}/>);expect(screen.queryByText('QA resize')).toBeNull()
})
it('fragmento combinado ofrece guardas y ref es una figura diferente',()=>{
 const {container,rerender}=render(<AtlasNode {...node('uml-frame','uml-sequence',{summary:'[válido]\nelse',uml:{classifier:'alt'}})}/>);expect(container.querySelector('.uml-combined-fragment')).toBeTruthy();expect(screen.getByText('[válido]')).toBeTruthy();expect(screen.getByText('[else]')).toBeTruthy();expect(screen.getByText('alt')).toBeTruthy()
 rerender(<AtlasNode {...node('uml-interaction','uml-sequence',{summary:'Autenticación'})}/>);expect(container.querySelector('.uml-interaction-ref')).toBeTruthy();expect(screen.getByText('ref')).toBeTruthy();expect(screen.getByText('Autenticación')).toBeTruthy();expect(container.querySelector('.uml-combined-fragment')).toBeNull()
})
it('línea de vida recortada termina donde se encuentra destrucción',()=>{
 const {container}=render(<AtlasNode {...node('uml-lifeline','uml-sequence',{}, {sequenceEndY:237})}/>);expect((container.querySelector('.uml-lifeline-tail') as HTMLElement).style.height).toBe('200px')
})
const structural:[DiagramType,ElementType,string][]=[['uml-composite','uml-class','.uml-composite-header'],['uml-composite','uml-part','.uml-composite-part-content'],['uml-composite','uml-reference-role','.uml-composite-part-content'],['uml-composite','uml-port','.uml-composite-port'],['uml-composite','uml-collaboration','.uml-composite-collaboration-title'],['uml-deployment','uml-node','.uml-deployment-symbol'],['uml-deployment','uml-device','.uml-deployment-symbol'],['uml-deployment','uml-execution','.uml-deployment-symbol'],['uml-deployment','uml-artifact','.uml-deployment-symbol'],['uml-package','uml-package','.uml-package-tab'],['uml-package','uml-subpackage','.uml-package-tab'],['uml-profile','uml-profile','.uml-package-tab'],['uml-profile','uml-metaclass','.uml-profile-stereotype'],['uml-profile','uml-stereotype','.uml-profile-stereotype'],['uml-usecase','uml-subject','.uml-subject-title'],['uml-usecase','actor','.uml-actor-figure'],['uml-component','component','.uml-component-heading'],['uml-class','uml-interface','.uml-class-header'],['uml-class','uml-enumeration','.uml-class-header'],['uml-object','uml-object','.uml-object-slots'],['uml-communication','uml-object','.uml-communication-title'],['uml-activity','uml-partition','.uml-partition-heading'],['uml-activity','uml-action','.uml-action-label'],['uml-activity','uml-object-node','.uml-object-node-label'],['uml-state','uml-region','.uml-state-region-title'],['uml-state','uml-state','.uml-state-compartment']]
for(const [diagram,kind,selector] of structural)it(`${diagram}: ${kind} dibuja su representación especializada`,()=>{
 const {container}=render(<AtlasNode {...node(kind,diagram,{summary:'entry / iniciar',uml:{classifier:'TipoQA',attributes:[{id:'a',name:'saldo',type:'Integer',visibility:'private'}],operations:[{id:'o',name:'pagar',returnType:'void',visibility:'public',parameters:[]}],slots:[{id:'s',name:'saldo',value:'42',type:'Integer'}]}},{childrenCount:2,nestingDepth:1})}/>);expect(container.querySelector(selector)).toBeTruthy();expect(container.textContent).toContain('Elemento QA')
})
const terminals:UmlTerminal[]=['diamond-open','diamond-filled','triangle','extension','open-arrow','filled-arrow','ball','socket','cross']
for(const kind of terminals)it(`terminal UML ${kind} es geometría orientada al puerto`,()=>{
 const {container}=render(<svg><Terminal kind={kind} x={20} y={40} angle={90}/></svg>);const terminal=container.querySelector(`[data-uml-terminal="${kind}"]`)!;expect(terminal.getAttribute('transform')).toBe('translate(20,40) rotate(90)');expect(terminal.querySelector('path,polygon,circle')).toBeTruthy()
})
it('terminales sin símbolo se omiten y los ángulos cardinales son deterministas',()=>{
 const {container}=render(<svg><Terminal kind="none" x={0} y={0} angle={0}/><Terminal kind="assembly" x={0} y={0} angle={0}/></svg>);expect(container.querySelector('g')).toBeNull();expect(['right','left','top','bottom'].map(side=>terminalAngle(side,0,0,1,1))).toEqual([0,180,-90,90]);expect(terminalAngle(undefined,0,0,10,10)).toBe(45);expect(umlRelationAdornment('realization').dash).toBe(true)
})
it('mensajes: síncrono, retorno y restricción usan puntas y trazos distintos',()=>{
 const {container,rerender}=render(<svg><AtlasUmlEdge {...edge({relationKind:'message'},'enviar')}/></svg>);expect(container.querySelector('[data-uml-terminal="filled-arrow"]')).toBeTruthy();expect(screen.getByText('enviar')).toBeTruthy()
 rerender(<svg><AtlasUmlEdge {...edge({relationKind:'reply'},'respuesta')}/></svg>);expect(container.querySelector('[data-uml-terminal="open-arrow"]')).toBeTruthy();expect((screen.getByTestId('edge-r') as unknown as SVGElement).style.strokeDasharray).toBe('7 5')
 rerender(<svg><AtlasUmlEdge {...edge({relationKind:'constraint'})}/></svg>);expect((screen.getByTestId('edge-r') as unknown as SVGElement).style.strokeDasharray).toBe('2 5');expect(container.querySelector('[data-uml-terminal]')).toBeNull()
})
it('ensamblaje abre máscara central; conector compuesto dibuja cuadrados y multiplicidades',()=>{
 const {container,rerender}=render(<svg><AtlasUmlEdge {...edge({relationKind:'assembly'},'Interfaz')}/></svg>);expect(container.querySelector('mask')).toBeTruthy();expect(container.querySelector('[data-uml-terminal="assembly"] circle')).toBeTruthy();expect(screen.getByTestId('edge-r').getAttribute('style')).toContain('atlas-assembly-gap-r')
 rerender(<svg><AtlasUmlEdge {...edge({relationKind:'connector',diagramType:'uml-composite',sourceElementType:'uml-part',targetElementType:'uml-port',sourceRole:'origen',targetRole:'destino',sourceMultiplicity:'1',targetMultiplicity:'0..*'})}/></svg>);expect(container.querySelectorAll('[data-uml-terminal="port-square"]')).toHaveLength(2);expect(screen.getByText('origen 1')).toBeTruthy();expect(screen.getByText('destino 0..*')).toBeTruthy();expect(container.querySelector('mask')).toBeNull()
})
it('relaciones paralelas muestran rutas y etiquetas independientes, marcadores originales',()=>{
 const props={...edge({parallelOffset:32,parallelPath:'straight'},'Solicitud'),markerEnd:'url(#arrow)'};const {rerender}=render(<svg><AtlasParallelEdge {...props}/></svg>);const path=screen.getByTestId('edge-r').getAttribute('d');expect(screen.getByTestId('edge-r').getAttribute('marker-end')).toBe('url(#arrow)');expect(screen.getByText('Solicitud')).toBeTruthy()
 rerender(<svg><AtlasParallelEdge {...edge({parallelOffset:-32,parallelPath:'straight'},'Respuesta')}/></svg>);expect(screen.getByTestId('edge-r').getAttribute('d')).not.toBe(path);expect(screen.getByText('Respuesta')).toBeTruthy();rerender(<svg><AtlasParallelEdge {...edge({},' ')}/></svg>);expect(document.querySelector('.atlas-parallel-edge-label')).toBeNull()
})

it('conector sin datos usa asociación y ruta recta por defecto',()=>{
 const {container}=render(<svg><AtlasUmlEdge {...edge()} data={undefined}/></svg>);expect(screen.getByTestId('edge-r').getAttribute('d')).toBeTruthy();expect(container.querySelector('[data-uml-terminal]')).toBeNull();expect(container.querySelector('.atlas-parallel-edge-label')).toBeNull()
})
it('cajas normales exponen enlaces genéricos o C4 y respetan perspectiva',()=>{
 const {container,rerender}=render(<AtlasNode {...node('system','c1',{summary:'Resumen QA',technical:'Detalle QA',childDiagramId:'d'})}/>);expect(screen.getByText('Resumen QA')).toBeTruthy();expect(screen.getByText('Detalle QA')).toBeTruthy();expect(container.querySelector('.node-drill')?.getAttribute('title')).toMatch(/vista vinculada/)
 rerender(<AtlasNode {...node('system','c1',{summary:'Resumen QA',technical:'Detalle QA',childDiagramId:'d'},{linkedDiagramType:'c2',mode:'technical'})}/>);expect(screen.queryByText('Resumen QA')).toBeNull();expect(screen.getByText('Detalle QA')).toBeTruthy();expect(container.querySelector('.node-drill b')?.textContent).toBe('C2')
 rerender(<AtlasNode {...node('system','c1',{summary:'Resumen QA',technical:'Detalle QA',childDiagramId:'d'},{linkedDiagramType:'process',mode:'functional'})}/>);expect(screen.getByText('Resumen QA')).toBeTruthy();expect(screen.queryByText('Detalle QA')).toBeNull();expect(container.querySelector('.node-drill b')).toBeNull()
})

it('representa fichas UML mínimas sin inventar propiedades ni contenido',()=>{
 const {container,rerender}=render(<AtlasNode {...node('uml-class','uml-class')}/>);expect(screen.queryByText('Sin atributos')).toBeNull();expect(screen.queryByText('Sin operaciones')).toBeNull();expect(screen.getByText('«Class»')).toBeTruthy()
 rerender(<AtlasNode {...node('uml-object','uml-object')}/>);expect(screen.getByText('Sin valores de instancia')).toBeTruthy()
 rerender(<AtlasNode {...node('uml-object','uml-object',{uml:{slots:[{id:'s',name:'activo',value:'true'}]}})}/>);expect(screen.getByText('activo = true')).toBeTruthy()
 rerender(<AtlasNode {...node('uml-stereotype','uml-profile')}/>);expect(container.querySelector('.uml-structural-compartment')).toBeNull()
 rerender(<AtlasNode {...node('uml-package','uml-package')}/>);expect(screen.getByText('Paquete')).toBeTruthy();expect(screen.getByText(/0 elementos contenidos/)).toBeTruthy()
 rerender(<AtlasNode {...node('uml-model','uml-package',{uml:{visibility:'public'}})}/>);expect(screen.getByText('«model»')).toBeTruthy();expect(screen.getByText(/Visibilidad: public/)).toBeTruthy()
 rerender(<AtlasNode {...node('uml-object-node','uml-activity')}/>);expect(container.querySelector('.uml-object-node-label .atlas-uml-type-identifier')?.textContent).toBe('«Object Node»');expect(Array.from(container.querySelectorAll('.uml-object-node-label small:not(.atlas-uml-type-identifier)')).every(n=>!n.textContent?.trim())).toBe(true)
 rerender(<AtlasNode {...node('uml-state','uml-state')}/>);expect(container.querySelector('.uml-state-compartment')).toBeNull()
 rerender(<AtlasNode {...node('uml-region','uml-state')}/>);expect(container.querySelector('.uml-state-region-caption')).toBeNull()
 rerender(<AtlasNode {...node('uml-interaction','uml-sequence')}/>);expect(container.querySelector('.uml-interaction-ref-summary')).toBeNull()
 rerender(<AtlasNode {...node('uml-frame','uml-communication')}/>);expect(screen.getByText('sd')).toBeTruthy();expect(container.querySelector('.uml-interaction-frame-summary')).toBeNull()
 rerender(<AtlasNode {...node('uml-execution','uml-deployment',{uml:{runtimeIcon:'docker'}})}/>);expect(screen.getByText('docker')).toBeTruthy()
})

// Scoped smoke for each diagram, in the existing global UI suite as well.
for(const diagram of UML_DIAGRAMS)it(`[${diagram}] renderiza cada tipo del catálogo con su geometría`,()=>{
 for(const kind of UML_ELEMENTS_BY_DIAGRAM[diagram]||[]){
  const {container,unmount}=render(<AtlasNode {...node(kind,diagram)}/>);
  const shape=container.querySelector(`.kind-${kind}`);expect(shape,`${diagram}/${kind}`).toBeTruthy();
  const ports=container.querySelectorAll('[data-port]')
  // UC-11: un sujeto es un límite visual, no un extremo de relación.
  if((diagram==='uml-usecase'&&kind==='uml-subject')||(diagram==='uml-activity'&&['uml-partition','uml-activity-interruptible-region'].includes(kind)))expect(ports,`${diagram}/${kind}: sin conectores`).toHaveLength(0)
  else if(diagram==='uml-usecase'&&(kind==='actor'||kind==='usecase')){
   expect(ports,`${diagram}/${kind}: cuatro anclas cardinales`).toHaveLength(4)
   expect([...ports].map(p=>p.getAttribute('data-side')).sort()).toEqual(['bottom','left','right','top'])
  }else if(diagram==='uml-activity'&&['uml-start','uml-end','uml-flow-final','uml-decision','uml-activity-pin'].includes(kind))expect(ports,`${diagram}/${kind}: cuatro anclas`).toHaveLength(4)
  else if(diagram==='uml-activity'&&kind==='uml-fork')expect(ports,`${diagram}/${kind}: ocho anclas`).toHaveLength(8)
  else expect(ports.length,`${diagram}/${kind}: conectores`).toBeGreaterThan(0)
  unmount()
 }
})

it('[uml-usecase] UC-11 límite nunca expone puertos, y las variantes rectangulares conservan anclas',()=>{
 const {container,rerender}=render(<AtlasNode {...node('uml-subject','uml-usecase',{}, {canResize:true,childrenCount:2},true)}/>);
 expect(container.querySelector('.uml-subject-title')?.textContent).toBe('Elemento QA')
 expect(container.querySelectorAll('[data-port]')).toHaveLength(0)
 expect(screen.getByRole('button',{name:'QA resize'})).toBeTruthy()
 for(const kind of ['actor','usecase'] as const){
  rerender(<AtlasNode {...node(kind,'uml-usecase',{useCaseDetail:{presentation:'rectangle'}})}/>);
  expect(container.querySelector('.uc-rectangle')).toBeTruthy();expect(container.querySelectorAll('[data-port]')).toHaveLength(8)
  if(kind==='usecase')expect(container.querySelector('.uc-ellipse-icon ellipse')).toBeTruthy()
  else expect(container.querySelector('.uml-actor-figure')).toBeNull()
 }
})
it('[uml-usecase] AUD-UC-003 actor ancla lateral sobre figura, óvalo y nota enlazada',()=>{
 const {container,rerender}=render(<AtlasNode {...node('actor','uml-usecase',{useCaseDetail:{stereotype:'external'}})}/>);const port=container.querySelector('[data-port="left"]') as HTMLElement;expect(port.style.left).toContain('calc(');expect(port.style.top).not.toBe('50%');expect(screen.getByText('«external»')).toBeTruthy();expect(container.querySelectorAll('[data-port]')).toHaveLength(4)
 rerender(<AtlasNode {...node('usecase','uml-usecase',{useCaseDetail:{extensionPoints:[{id:'p',name:'Antes'}]}})}/>);expect(container.querySelectorAll('[data-port]')).toHaveLength(4);expect(screen.getByText('Antes')).toBeTruthy()
 rerender(<svg><AtlasUmlEdge {...edge({diagramType:'uml-usecase',relationKind:'extend',extensionNote:['condition: {ok}','extension points: Antes']},'nombre indebido')}/></svg>);expect(container.querySelector('[data-uml-note-anchor]')).toBeTruthy();expect(screen.getByText('«extend»')).toBeTruthy();expect(screen.queryByText('nombre indebido')).toBeNull();expect(container.querySelector('[data-uml-terminal="open-arrow"]')).toBeTruthy()
 rerender(<svg><AtlasUmlEdge {...edge({diagramType:'uml-usecase',relationKind:'extend'})}/></svg>);expect(container.querySelector('[data-uml-note-anchor]')).toBeNull()
})

it('uml-activity: excepción usa conector de rayo dirigido distinto del flujo interruptor',()=>{const {container,rerender}=render(<svg><AtlasUmlEdge {...edge({diagramType:'uml-activity',relationKind:'exception-handler'})}/></svg>);const exception=container.querySelector('[data-testid="edge-r"], .react-flow__edge-path')?.getAttribute('d');expect(exception).toBeTruthy();expect(container.querySelector('[data-activity-interrupt]')).toBeNull();rerender(<svg><AtlasUmlEdge {...edge({diagramType:'uml-activity',relationKind:'control-flow',activityInterrupted:true})}/></svg>);expect(container.querySelector('[data-activity-interrupt]')).toBeTruthy();expect(container.querySelector('[data-testid="edge-r"], .react-flow__edge-path')?.getAttribute('d')).not.toBe(exception)})
