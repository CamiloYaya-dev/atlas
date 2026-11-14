import {UserRound,Boxes,Database,Code2,BookOpen,FileText,Workflow,Cloud,Layers,Maximize2,Server,Monitor,Smartphone,HardDrive,Network,Box,Container} from 'lucide-react'
import {Handle,Position,NodeResizer} from '@xyflow/react'
import type {NodeProps} from '@xyflow/react'
import {diagramLabels,elementLabels,umlAttributeText,umlOperationText,umlObjectTitle,atlasNodeMinimum} from '@atlas/contracts'
import type {DiagramType,ModelElement,Perspective} from '@atlas/contracts'
export function IconFor({type}:{type:string}){switch(type){case 'actor':return <UserRound size={15}/>;case 'system':return <Boxes size={15}/>;case 'database':return <Database size={15}/>;case 'endpoint':return <Code2 size={15}/>;case 'requirement':return <BookOpen size={15}/>;case 'usecase':return <FileText size={15}/>;case 'process':case 'activity':return <Workflow size={15}/>;case 'external':return <Cloud size={15}/>;default:return <Layers size={15}/>}}
/**
 * Control nodes in an UML Activity diagram are symbols, not cards.  Render them
 * outside AtlasNode's generic card tree so legacy .uml-diagram.kind-* CSS
 * cannot accidentally add a background, a second diamond or an outline.
 * Ports are attached to the actual SVG contour and remain addressable by the
 * identifiers used in diagrams saved before this change.
 */
const ACTIVITY_CONTROL_TYPES=new Set(['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork'])
function ActivityControlSymbol({id,kind,selected,canResize,onResize}:{
 id:string;kind:string;selected:boolean;canResize:boolean;
 onResize?: (nodeId:string,width:number,height:number,x?:number,y?:number)=>void
}){
 const isCircle=kind==='uml-start'||kind==='uml-end'||kind==='uml-flow-final'
 const isDecision=kind==='uml-decision'
 const isBar=kind==='uml-fork'
 const tip=isCircle?'5%':isDecision?'2.4%':'1%'
 const {width:minWidth,height:minHeight}=atlasNodeMinimum('uml-activity',kind as ModelElement['type'])
 const port=(portId:string,position:Position,style?:Record<string,string>)=><Handle
  key={portId} id={portId} type="source" position={position} className="node-handle atlas-activity-symbol-port"
  style={style} title={`Conector UML ${portId}`}/>
 const ports=[
  port('left',Position.Left,{left:tip}),
  ...(isBar?[20,50,80].map((pct,i)=>port(`top-${i+1}`,Position.Top,{left:`${pct}%`,top:'29%'})):
     [port('top-2',Position.Top,{left:'50%',top:tip})]),
  port('right',Position.Right,{right:tip}),
  ...(isBar?[20,50,80].map((pct,i)=>port(`bottom-${i+1}`,Position.Bottom,{left:`${pct}%`,bottom:'29%'})):
     [port('bottom-2',Position.Bottom,{left:'50%',bottom:tip})])
 ]
 return <div className={`atlas-activity-control ${isDecision?'uml-decision-card':''} ${isBar?'uml-fork-card':''} ${isCircle?'uml-pseudostate-card':''} ${kind==='uml-flow-final'?'uml-activity-flow-final':''} kind-${kind} ${selected?'selected':''}`}>
  {selected&&canResize&&<NodeResizer isVisible minWidth={minWidth} minHeight={minHeight}
   maxWidth={4000} maxHeight={4000} keepAspectRatio={isCircle||isDecision}
   color="#326ee7" handleClassName="atlas-uml-symbol-resize-handle" lineClassName="atlas-uml-symbol-resize-line"
   onResizeEnd={(_,size)=>onResize?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  {isDecision?<svg className="uml-decision-shape atlas-activity-glyph" viewBox="0 0 84 84" preserveAspectRatio="none" role="img" aria-label="Decisión o fusión UML: rombo">
    <polygon points="42,2 82,42 42,82 2,42" fill="white" stroke="#405a80" strokeWidth="2.5"/>
   </svg>:
   isBar?<svg className="uml-fork-symbol atlas-activity-glyph" viewBox="0 0 160 28" preserveAspectRatio="none" role="img" aria-label="Bifurcación o unión paralela UML">
    <rect x="2" y="9" width="156" height="10" rx="1" fill="#1e2741"/>
   </svg>:
   <svg className="uml-pseudostate-notation atlas-activity-glyph" viewBox="0 0 60 60" preserveAspectRatio="none"
    role="img" aria-label={kind==='uml-start'?'Nodo inicial UML':kind==='uml-end'?'Final de actividad UML':'Final de flujo UML: círculo con X'}>
    {kind==='uml-start'?<circle cx="30" cy="30" r="27" fill="#344965"/>:
     kind==='uml-end'?<><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><circle cx="30" cy="30" r="19" fill="#344965"/></>:
     <><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/>
      <path d="M18 18L42 42M42 18L18 42" stroke="#344965" strokeWidth="3" strokeLinecap="round"/></>}
   </svg>}
  {ports}
 </div>
}

export function AtlasNode({id,data,selected}:NodeProps){
 const element=data.element as ModelElement|undefined;const mode=data.mode as Perspective;const graphType=data.graphType as DiagramType
 if(!element)return <div className="node missing">Elemento no disponible</div>
 // UML activity symbols must bypass the generic card renderer entirely.
 if(data.graphType==='uml-activity'&&ACTIVITY_CONTROL_TYPES.has(element.type))
  return <ActivityControlSymbol id={id} kind={element.type} selected={!!selected}
    canResize={!!data.canResize} onResize={data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined}/>

 const technical=mode!=='functional';const feature=diagramLabels[graphType];const linkedDiagramType=data.linkedDiagramType as DiagramType|undefined
 const umlClass=graphType.startsWith('uml-')&&graphType!=='uml-composite'&&['uml-class','uml-interface','uml-enumeration'].includes(element.type)
 const compositeClassifier=graphType==='uml-composite'&&element.type==='uml-class'
 const compositePort=graphType==='uml-composite'&&element.type==='uml-port'
 const compositePart=graphType==='uml-composite'&&element.type==='uml-part'
 const compositeRole=graphType==='uml-composite'&&element.type==='uml-reference-role'
 const compositeCollaboration=graphType==='uml-composite'&&element.type==='uml-collaboration'
 const deployment=graphType==='uml-deployment'
 const umlObject=graphType==='uml-object'&&element.type==='uml-object'
 const umlPackage=graphType.startsWith('uml-')&&['uml-package','uml-subpackage','uml-model','uml-profile'].includes(element.type)
 const umlSubject=graphType==='uml-usecase'&&element.type==='uml-subject'
 const umlMetaclass=graphType==='uml-profile'&&element.type==='uml-metaclass'
 const umlStereotype=graphType==='uml-profile'&&element.type==='uml-stereotype'
 const umlComponent=graphType==='uml-component'&&element.type==='component'
 const umlDecision=graphType==='uml-activity'&&element.type==='uml-decision'
 const umlFork=graphType==='uml-activity'&&element.type==='uml-fork'
 const activityDiagram=graphType==='uml-activity'
 const umlAction=activityDiagram&&element.type==='uml-action'
 const umlObjectNode=activityDiagram&&element.type==='uml-object-node'
 const umlFlowFinal=activityDiagram&&element.type==='uml-flow-final'
 const umlPartition=activityDiagram&&element.type==='uml-partition'
 const umlLifeline=['uml-sequence','uml-communication','uml-timing'].includes(graphType)&&element.type==='uml-lifeline'
 const umlPseudostate=graphType.startsWith('uml-')&&['uml-start','uml-end'].includes(element.type)
 // UML activity control symbols use their actual geometry, not the generic 8-point rectangle.
 const activityFourPorts=activityDiagram&&['uml-start','uml-end','uml-flow-final','uml-decision'].includes(element.type)
 const activityCircular=activityDiagram&&['uml-start','uml-end','uml-flow-final'].includes(element.type)
 const activityBar=activityDiagram&&element.type==='uml-fork'
 const activityPortInset=activityCircular?'7%':activityFourPorts?'2.4%':undefined
 const attributeLines=element.uml?.attributes||[],operationLines=element.uml?.operations||[],slotLines=element.uml?.slots||[]
 const deploymentIcon=element.type==='uml-device'?(element.uml?.deviceIcon||'server'):element.type==='uml-execution'?(element.uml?.runtimeIcon||'generic'):'generic'
 const iconMap:Record<string,typeof Server>={server:Server,desktop:Monitor,android:Smartphone,mobile:Smartphone,network:Network,storage:HardDrive,docker:Container,jvm:Box,nodejs:Code2,database:Database,generic:Layers}
 const DeviceIcon=iconMap[deploymentIcon]||Layers
 const canResize=!!data.canResize
 const resizeCallback=data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined
 const {width:minWidth,height:minHeight}=atlasNodeMinimum(graphType,element.type)
 return <div className={`atlas-node kind-${element.type} ${graphType.startsWith('uml-')?'uml-diagram uml-diagram-'+graphType:''} ${umlClass?'uml-structural-class':''} {umlDecision?'uml-decision-card':''} {umlFork?'uml-fork-card':''} {umlLifeline?'uml-lifeline-card':''} {umlPseudostate?'uml-pseudostate-card':''} ${umlObject?'uml-instance-card':''} ${umlPackage?'uml-package-container':''} ${umlSubject?'uml-usecase-subject':''} ${umlMetaclass?'uml-metaclass-card':''} ${umlStereotype?'uml-stereotype-card':''} ${umlComponent?'uml-component-card':''} ${compositeClassifier?'uml-composite-classifier':''} ${compositePart?'uml-composite-part':''} ${compositeRole?'uml-composite-reference':''} ${compositePort?'uml-composite-port':''} ${compositeCollaboration?'uml-composite-collaboration':''} ${umlPackage&&data.nestingDepth?`uml-nested-level-${Math.min(2,Number(data.nestingDepth))}`:''} ${deployment?'uml-deployment-node':''} ${deployment&&Number(data.childrenCount||0)>0?'uml-deployment-container':''} ${selected?'selected':''}`}>
  {selected&&canResize&&<NodeResizer isVisible={true} minWidth={minWidth} minHeight={minHeight} maxWidth={4000} maxHeight={4000} keepAspectRatio={activityDiagram&&['uml-decision','uml-start','uml-end','uml-flow-final'].includes(element.type)}
    color="#326ee7" handleClassName="atlas-node-resize-handle" lineClassName={activityDiagram&&['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork'].includes(element.type)?'atlas-uml-symbol-resize-line':'atlas-node-resize-line'}
    onResizeEnd={(_,size)=>resizeCallback?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  <Handle id="left" type="source" position={Position.Left} className="node-handle" style={activityFourPorts?{left:activityPortInset}:undefined} title="Conector izquierdo (entrada o salida)"/>
  {activityFourPorts
    ?<Handle id="top-2" type="source" position={Position.Top} className="node-handle atlas-port-vertical" style={{left:'50%',top:activityPortInset}} title="Conector superior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`top-${i}`} id={`top-${i+1}`} type="source" position={Position.Top} className="node-handle atlas-port-vertical" style={{left:`${pct}%`,...(activityBar?{top:'29%'}:{})}} title={`Conector superior ${i+1} (entrada o salida)`}/>)}
  {graphType==='uml-usecase'&&element.type==='actor'&&<svg aria-label="Actor UML" className="uml-actor-figure" viewBox="0 0 40 55"><circle cx="20" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="M20 14 V34 M6 24 H34 M20 34 L8 51 M20 34 L32 51" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}

  {compositeClassifier?<><div className="uml-composite-header"><strong>{element.name}</strong><small>internal structure</small></div><div className="uml-composite-guidance">Partes, roles y puertos internos · mueve los elementos dentro</div></>:
  compositePart?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>{element.uml?.classifier||'Parte estructurada'} {element.summary||''}</small></div>:
  compositeRole?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>Rol de referencia · {element.uml?.classifier||'0..1'}</small></div>:
  compositePort?<><div className="node-top"><span className="node-kind"><IconFor type={element.type}/> Puerto UML</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}</>:
  compositeCollaboration?<div className="uml-composite-collaboration-title">{element.name}</div>:
  deployment?<><div className="uml-deployment-symbol"><DeviceIcon size={23}/><span>{element.type==='uml-node'?'«node»':element.type==='uml-device'?'«device»':element.type==='uml-execution'?'«executionEnvironment»':'«artifact»'}</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}{element.type==='uml-execution'&&deploymentIcon!=='generic'&&<span className="uml-runtime-kind">{deploymentIcon}</span>}</>:
  umlPackage?<><div className="uml-package-tab">{element.type==='uml-profile'?'«profile»':element.type==='uml-model'?'«model»':element.type==='uml-subpackage'?'Subpaquete':data.nestingDepth?'Paquete anidado':'Paquete'}</div><div className="uml-package-title">{element.name}</div><div className="uml-package-note">{element.uml?.visibility?`Visibilidad: ${element.uml.visibility} · `:''}{String(data.childrenCount||0)} elementos contenidos · arrastra dentro o usa el Inspector</div></>:
  umlSubject?<><div className="uml-subject-title">{element.name}</div><small className="uml-subject-caption">Sujeto · {String(data.childrenCount||0)} casos de uso</small></>:
  umlMetaclass?<><div className="uml-profile-stereotype">«metaclass»</div><strong className="node-title">{element.name}</strong></>:
  umlStereotype?<><div className="uml-profile-stereotype">«stereotype»</div><strong className="node-title">{element.name}</strong>{attributeLines.length>0&&<div className="uml-structural-compartment">{attributeLines.map(a=><div key={a.id}>{umlAttributeText(a)}</div>)}</div>}</>:
  umlClass?<><div className="uml-class-header">{element.type==='uml-interface'&&<small>«interface»</small>}{element.type==='uml-enumeration'&&<small>«enumeration»</small>}<strong>{element.name}</strong></div><div className="uml-structural-compartment" aria-label="Atributos de la clase">{attributeLines.length?attributeLines.map(a=><div key={a.id}>{umlAttributeText(a)}</div>):<span className="uml-compartment-empty">Sin atributos</span>}</div><div className="uml-structural-compartment" aria-label="Operaciones de la clase">{operationLines.length?operationLines.map(o=><div key={o.id}>{umlOperationText(o)}</div>):<span className="uml-compartment-empty">Sin operaciones</span>}</div></>:
  umlObject?<><div className="uml-object-header">{umlObjectTitle(element.name,element.uml?.classifier)}</div><div className="uml-object-slots" aria-label="Valores de instancia">{slotLines.length?slotLines.map(s=><div key={s.id}>{s.name}{s.type?`: ${s.type}`:''} = {s.value}</div>):<span className="uml-compartment-empty">Sin valores de instancia</span>}</div></>:
  umlDecision?<div className="uml-decision-shape" role="img" aria-label="Decisión o fusión UML: rombo"><svg viewBox="0 0 84 84" preserveAspectRatio="none" aria-hidden="true"><polygon points="42,2 82,42 42,82 2,42" fill="#fff" stroke="currentColor" strokeWidth="2.5"/></svg></div>:
  umlFlowFinal?<div className="uml-pseudostate-notation" role="img" aria-label="Final de flujo UML: círculo con X"><svg className="uml-flow-final-symbol" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="23" stroke="currentColor" strokeWidth="2.8" fill="white"/><path d="M16 16L38 38M38 16L16 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/></svg></div>:
  umlPartition?<><div className="uml-partition-heading">{element.name}</div><div className="uml-partition-description">Partición de actividad · {String(data.childrenCount||0)} nodos</div></>:
  umlAction?<div className="uml-action-label">{element.name}</div>:
  umlObjectNode?<div className="uml-object-node-label"><span>{element.name}</span>{element.uml?.classifier&&<small>: {element.uml.classifier}</small>}</div>:
  umlFork?<div className="uml-fork-symbol" role="img" aria-label="Bifurcación o unión paralela UML"/>:
  umlLifeline?<div className="uml-lifeline-notation"><div className="uml-lifeline-head">{element.name}</div><div className="uml-lifeline-tail" aria-hidden="true"/></div>:
  umlPseudostate?<div className="uml-pseudostate-notation" aria-label={element.type==='uml-start'?'Nodo inicial UML':'Nodo final UML'}><span className={element.type==='uml-start'?'uml-start-symbol':'uml-end-symbol'}/></div>:
  <>{umlComponent?<div className="uml-component-heading"><span>«component»</span><svg viewBox="0 0 30 28" width="26" height="25" aria-label="Símbolo UML de componente"><rect x="8" y="3" width="19" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="8" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="16" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/></svg></div>:<div className="node-top"><span className="node-kind"><IconFor type={element.type}/>{elementLabels[element.type]}</span>{element.childDiagramId&&<span className="node-drill" title={linkedDiagramType?`Doble clic para abrir ${diagramLabels[linkedDiagramType]}`:'Doble clic para abrir la vista vinculada'}>{linkedDiagramType?.startsWith('c')?<b>{linkedDiagramType.toUpperCase()}</b>:<Maximize2 size={11}/>}</span>}</div>}
  <div className="node-title">{element.name}</div>
  {mode!=='technical'&&element.summary&&<div className="node-summary">{element.summary}</div>}
  {technical&&element.technical&&<div className="node-tech"><Code2 size={12}/><span>{element.technical}</span></div>}
  {graphType==='trace'&&<span className="node-mini-label">{feature}</span>}</>}
  <Handle id="right" type="source" position={Position.Right} className="node-handle" style={activityFourPorts?{right:activityPortInset}:undefined} title="Conector derecho (entrada o salida)"/>
  {activityFourPorts
    ?<Handle id="bottom-2" type="source" position={Position.Bottom} className="node-handle atlas-port-vertical" style={{left:'50%',bottom:activityPortInset}} title="Conector inferior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`bottom-${i}`} id={`bottom-${i+1}`} type="source" position={Position.Bottom} className="node-handle atlas-port-vertical" style={{left:`${pct}%`,...(activityBar?{bottom:'29%'}:{})}} title={`Conector inferior ${i+1} (entrada o salida)`}/>)}
 </div>
}
export const nodeTypes={atlas:AtlasNode}
