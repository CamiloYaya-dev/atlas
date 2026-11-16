import {umlTypeIdentifier,classTemplateFormalText,UC_ACTOR_GLYPH} from '@atlas/contracts'
import {UserRound,Boxes,Database,Code2,BookOpen,FileText,Workflow,Cloud,Layers,Maximize2,Server,Monitor,Smartphone,HardDrive,Network,Box,Container} from 'lucide-react'
import {Handle,Position,NodeResizer,useUpdateNodeInternals} from '@xyflow/react'
import {useEffect} from 'react'
import type {NodeProps} from '@xyflow/react'
import {diagramLabels,elementLabels,umlAttributeText,umlOperationText,umlOperationTextResolved,umlObjectTitle,atlasNodeMinimum,sequenceActivationPorts} from '@atlas/contracts'
import type {DiagramType,ModelElement,Perspective} from '@atlas/contracts'
export function IconFor({type}:{type:string}){switch(type){case 'actor':return <UserRound size={15}/>;case 'system':return <Boxes size={15}/>;case 'database':return <Database size={15}/>;case 'endpoint':return <Code2 size={15}/>;case 'requirement':return <BookOpen size={15}/>;case 'usecase':return <FileText size={15}/>;case 'process':case 'activity':return <Workflow size={15}/>;case 'external':return <Cloud size={15}/>;default:return <Layers size={15}/>}}
/**
 * UML control / pseudostate nodes are symbols, not cards. Render them outside
 * the generic card tree so legacy .uml-diagram.kind-* CSS cannot accidentally
 * add a background, a second diamond or an outline. Ports stay attached to the
 * real contour of the symbol and preserve the historical ids saved in ATLAS.
 */
const ACTIVITY_CONTROL_TYPES=new Set(['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork'])
const STATE_CONTROL_TYPES=new Set(['uml-start','uml-end','uml-decision','uml-fork','uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point','uml-terminate'])
const SEQUENCE_SYMBOL_TYPES=new Set(['uml-activation','uml-destruction'])
/** React Flow caches handle bounds; invalidate after changing bar height/count. */
function ActivationHandles({id,height}:{id:string;height:number}){
 const updateNodeInternals=useUpdateNodeInternals()
 useEffect(()=>{updateNodeInternals(id)},[id,height,updateNodeInternals])
 const ports=sequenceActivationPorts(height)
 return <>
  {/* Backward-compatible center anchors for existing JSON documents. */}
  <Handle id="left" type="source" position={Position.Left} className="node-handle atlas-sequence-symbol-port" style={{left:'35.42%',top:'50%'}} title="Mensaje UML lateral izquierdo"/>
  <Handle id="right" type="source" position={Position.Right} className="node-handle atlas-sequence-symbol-port" style={{right:'35.42%',top:'50%'}} title="Mensaje UML lateral derecho"/>
  {ports.map(p=><Handle key={p.id} id={p.id} type="source" position={p.side==='left'?Position.Left:Position.Right} className="node-handle atlas-sequence-symbol-port" style={{[p.side]:'35.42%',top:`${p.topPercent}%`}} title={`Mensaje ${p.side==='left'?'izquierdo':'derecho'} · ${p.topPercent}%`}/>) }
 </>
}
function UmlControlSymbol({id,graphType,kind,selected,canResize,onResize,activationHeight}:{
 id:string;graphType:DiagramType;kind:string;selected:boolean;canResize:boolean;activationHeight?:number;
 onResize?: (nodeId:string,width:number,height:number,x?:number,y?:number)=>void
}){
 const activity=graphType==='uml-activity'
 const state=graphType==='uml-state'
 const sequence=graphType==='uml-sequence'
 const isCircle=['uml-start','uml-end','uml-flow-final','uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point'].includes(kind)
 const isDecision=kind==='uml-decision'
 const isBar=kind==='uml-fork'
 const isTerminate=kind==='uml-terminate'
 const isActivation=kind==='uml-activation'
 const isDestruction=kind==='uml-destruction'
 const minGraph=(activity?'uml-activity':state?'uml-state':'uml-sequence') as DiagramType
 const {width:minWidth,height:minHeight}=atlasNodeMinimum(minGraph,kind as ModelElement['type'])
 const portClass=sequence?'atlas-sequence-symbol-port':'atlas-activity-symbol-port'
 const port=(portId:string,position:Position,style?:Record<string,string>)=><Handle
  key={portId} id={portId} type="source" position={position} className={`node-handle ${portClass}`}
  style={style} title={`Conector UML ${portId}`}/>
 const tip=isCircle?'6%':isDecision?'2.4%':isTerminate?'1%':undefined
 // Activation messages attach ONLY to its lateral edges, at many heights.
 // Width of the visible UML bar is 14/48 units; inset each connection to it.
 // Preserve historical left/right handle ids for already persisted messages.
 const ports=isActivation?[]:[
  ...(isBar?[port('left',Position.Left,{left:'1%'}),...([20,50,80].map((pct,i)=>port(`top-${i+1}`,Position.Top,{left:`${pct}%`,top:'29%'}))),port('right',Position.Right,{right:'1%'}),...([20,50,80].map((pct,i)=>port(`bottom-${i+1}`,Position.Bottom,{left:`${pct}%`,bottom:'29%'})))]:
  [port('left',Position.Left,tip?{left:tip}:undefined),port('top-2',Position.Top,isDecision?{left:'50%',top:'2.4%'}:tip?{left:'50%',top:tip}:undefined),port('right',Position.Right,tip?{right:tip}:undefined),port('bottom-2',Position.Bottom,isDecision?{left:'50%',bottom:'2.4%'}:tip?{left:'50%',bottom:tip}:undefined)])
 ]
 const label=kind==='uml-start'?'Nodo inicial UML':
  kind==='uml-end'?(state?'Final de región / estado UML':'Final UML'):
  kind==='uml-flow-final'?'Final de flujo UML':
  kind==='uml-decision'?(state?'Elección o unión UML':'Decisión o fusión UML'):
  kind==='uml-fork'?(state?'Bifurcación o unión UML de máquina de estados':'Bifurcación o unión paralela UML'):
  kind==='uml-history-shallow'?'Historial superficial UML':
  kind==='uml-history-deep'?'Historial profundo UML':
  kind==='uml-entry-point'?'Punto de entrada UML':
  kind==='uml-exit-point'?'Punto de salida UML':
  kind==='uml-terminate'?'Terminación UML':
  kind==='uml-activation'?'Ejecución o activación UML':
  'Destrucción UML'
 return <div className={`atlas-uml-control graph-${graphType} ${isDecision?'uml-decision-card':''} ${isBar?'uml-fork-card':''} ${isCircle?'uml-pseudostate-card':''} ${kind==='uml-flow-final'?'uml-activity-flow-final':''} ${isActivation?'uml-sequence-activation-card':''} ${isDestruction?'uml-sequence-destruction-card':''} kind-${kind} ${selected?'selected':''}`}>
  {selected&&canResize&&<NodeResizer isVisible minWidth={minWidth} minHeight={minHeight}
   maxWidth={4000} maxHeight={4000} keepAspectRatio={isCircle||isDecision||isDestruction||isTerminate}
   color="#326ee7" handleClassName="atlas-uml-symbol-resize-handle" lineClassName="atlas-uml-symbol-resize-line"
   onResizeEnd={(_,size)=>onResize?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  {isDecision?<svg className="uml-decision-shape uml-control-glyph" viewBox="0 0 84 84" preserveAspectRatio="none" role="img" aria-label={label}>
    <polygon points="42,2 82,42 42,82 2,42" fill="white" stroke="#405a80" strokeWidth="2.5"/>
   </svg>:
   isBar?<svg className="uml-fork-symbol uml-control-glyph" viewBox="0 0 160 28" preserveAspectRatio="none" role="img" aria-label={label}>
    <rect x="2" y="9" width="156" height="10" rx="1" fill="#1e2741"/>
   </svg>:
   isActivation?<svg className="uml-sequence-activation-bar uml-control-glyph" viewBox="0 0 48 120" preserveAspectRatio="none" role="img" aria-label={label}>
    <rect x="17" y="2" width="14" height="116" fill="white" stroke="#344965" strokeWidth="2"/>
   </svg>:
   isDestruction?<svg className="uml-sequence-destruction-mark uml-control-glyph" viewBox="0 0 48 48" preserveAspectRatio="none" role="img" aria-label={label}>
    <path d="M 9 9 L 39 39 M 39 9 L 9 39" stroke="#344965" strokeWidth="4" strokeLinecap="round"/>
   </svg>:
   isTerminate?<svg className="uml-terminate-symbol uml-control-glyph" viewBox="0 0 40 40" preserveAspectRatio="none" role="img" aria-label={label}>
    <path d="M 9 9 L 39 39 M 39 9 L 9 39" stroke="#344965" strokeWidth="4" strokeLinecap="round"/>
   </svg>:
   <svg className="uml-pseudostate-notation uml-control-glyph" viewBox="0 0 60 60" preserveAspectRatio="none" role="img" aria-label={label}>
    {kind==='uml-start'?<circle cx="30" cy="30" r="27" fill="#344965"/>:
     kind==='uml-end'?<><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><circle cx="30" cy="30" r="19" fill="#344965"/></>:
     kind==='uml-flow-final'?<><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><path d="M18 18L42 42M42 18L18 42" stroke="#344965" strokeWidth="3" strokeLinecap="round"/></>:
     kind==='uml-history-shallow'?<><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><text x="30" y="37" textAnchor="middle" fontSize="25" fontWeight="700" fill="#344965">H</text></>:
     kind==='uml-history-deep'?<><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><text x="30" y="34" textAnchor="middle" fontSize="22" fontWeight="700" fill="#344965">H</text><text x="41" y="22" textAnchor="middle" fontSize="12" fontWeight="700" fill="#344965">*</text></>:
     kind==='uml-entry-point'?<circle cx="30" cy="30" r="18" fill="white" stroke="#344965" strokeWidth="3"/>:
     <><circle cx="30" cy="30" r="27" fill="white" stroke="#344965" strokeWidth="3"/><path d="M20 20L40 40M40 20L20 40" stroke="#344965" strokeWidth="3.2" strokeLinecap="round"/></>}
   </svg>}
  {isActivation?<ActivationHandles id={id} height={activationHeight||120}/>:ports}
 </div>
}

export function AtlasNode({id,data,selected}:NodeProps){
 const element=data.element as ModelElement|undefined;const mode=data.mode as Perspective;const graphType=data.graphType as DiagramType
 if(!element)return <div className="node missing">Elemento no disponible</div>
 // UML symbol nodes must bypass the generic card renderer entirely.
 if((data.graphType==='uml-activity'&&ACTIVITY_CONTROL_TYPES.has(element.type))||
    (data.graphType==='uml-state'&&STATE_CONTROL_TYPES.has(element.type))||
    (data.graphType==='uml-sequence'&&SEQUENCE_SYMBOL_TYPES.has(element.type)))
  return <UmlControlSymbol id={id} graphType={data.graphType as DiagramType} kind={element.type} selected={!!selected}
    activationHeight={typeof data.sequenceActivationHeight==='number'?data.sequenceActivationHeight:undefined}
    canResize={!!data.canResize} onResize={data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined}/>

 const technical=mode!=='functional';const feature=diagramLabels[graphType];const linkedDiagramType=data.linkedDiagramType as DiagramType|undefined
 const activityDiagram=graphType==='uml-activity'
 const stateDiagram=graphType==='uml-state'
 const sequenceDiagram=graphType==='uml-sequence'
 const communicationDiagram=graphType==='uml-communication'
 const umlClass=graphType.startsWith('uml-')&&graphType!=='uml-composite'&&['uml-class','uml-interface','uml-enumeration','uml-datatype','uml-primitive','uml-signal','uml-association-class'].includes(element.type)
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
 const umlDecision=(activityDiagram||stateDiagram)&&element.type==='uml-decision'
 const umlFork=(activityDiagram||stateDiagram)&&element.type==='uml-fork'
 const umlAction=activityDiagram&&element.type==='uml-action'
 const umlObjectNode=activityDiagram&&element.type==='uml-object-node'
 const umlFlowFinal=activityDiagram&&element.type==='uml-flow-final'
 const umlPartition=activityDiagram&&element.type==='uml-partition'
 const umlSequenceParticipant=sequenceDiagram&&(element.type==='uml-lifeline'||element.type==='actor')
 const umlSequenceActivation=sequenceDiagram&&element.type==='uml-activation'
 const umlSequenceDestruction=sequenceDiagram&&element.type==='uml-destruction'
 const umlCommunicationParticipant=communicationDiagram&&['actor','uml-object','uml-lifeline'].includes(element.type)
 const umlLifeline=(['uml-sequence','uml-communication','uml-timing'].includes(graphType)&&element.type==='uml-lifeline')||umlSequenceParticipant
 const umlSequenceFrame=(sequenceDiagram||communicationDiagram)&&element.type==='uml-frame'
 const umlInteractionRef=sequenceDiagram&&element.type==='uml-interaction'
 const umlStateNode=stateDiagram&&element.type==='uml-state'
 const umlStateRegion=stateDiagram&&element.type==='uml-region'
 const umlPseudostate=graphType.startsWith('uml-')&&['uml-start','uml-end'].includes(element.type)
 // UML symbols use their native geometry, not the generic 8-point rectangle.
 const activityFourPorts=(activityDiagram||stateDiagram)&&['uml-start','uml-end','uml-flow-final','uml-decision'].includes(element.type)
 const activityCircular=(activityDiagram||stateDiagram)&&['uml-start','uml-end','uml-flow-final'].includes(element.type)
 const activityBar=(activityDiagram||stateDiagram)&&element.type==='uml-fork'
 const activityPortInset=activityCircular?'7%':activityFourPorts?'2.4%':undefined
 const attributeLines=element.uml?.attributes||[],operationLines=element.uml?.operations||[],slotLines=element.uml?.slots||[]
 const stateLines=(element.summary||'').split(/\n+/).map(line=>line.trim()).filter(Boolean)
 const interactionOperator=(element.uml?.classifier||'').trim()||(sequenceDiagram?'alt':'sd')
 const combinedOperands=(element.summary||'[condición]\n[else]').split(/\n+/).map(guard=>guard.trim()).filter(Boolean)
 const deploymentIcon=element.type==='uml-device'?(element.uml?.deviceIcon||'server'):element.type==='uml-execution'?(element.uml?.runtimeIcon||'generic'):'generic'
 const iconMap:Record<string,typeof Server>={server:Server,desktop:Monitor,android:Smartphone,mobile:Smartphone,network:Network,storage:HardDrive,docker:Container,jvm:Box,nodejs:Code2,database:Database,generic:Layers}
 const DeviceIcon=iconMap[deploymentIcon]||Layers
 const uc=graphType==='uml-usecase'&&['actor','usecase'].includes(element.type),ucRectangle=uc&&element.useCaseDetail?.presentation==='rectangle',ucCardinal=uc&&!ucRectangle
 const actorGlyph=uc&&element.type==='actor'&&!ucRectangle,glyph=UC_ACTOR_GLYPH
 const actorPortStyle=(side:'left'|'right'|'top'|'bottom')=>actorGlyph?(side==='left'||side==='right'?{[side]:`calc(50% - ${14*glyph.width/40}px)`,top:glyph.top+24*glyph.height/55}:side==='top'?{left:'50%',top:glyph.top+2*glyph.height/55}:{left:'50%',top:glyph.top+51*glyph.height/55,bottom:'auto'}):undefined
 const canResize=!!data.canResize
 const resizeCallback=data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined
 const {width:minWidth,height:minHeight}=atlasNodeMinimum(graphType,element.type)
 return <div className={`atlas-node kind-${element.type} ${graphType.startsWith('uml-')?'uml-diagram uml-diagram-'+graphType:''} ${umlClass?'uml-structural-class':''} ${umlDecision?'uml-decision-card':''} ${umlFork?'uml-fork-card':''} ${umlLifeline?'uml-lifeline-card':''} ${umlPseudostate?'uml-pseudostate-card':''} ${umlObject?'uml-instance-card':''} ${umlPackage?'uml-package-container':''} ${umlSubject?'uml-usecase-subject':''} ${umlMetaclass?'uml-metaclass-card':''} ${umlStereotype?'uml-stereotype-card':''} ${umlComponent?'uml-component-card':''} ${compositeClassifier?'uml-composite-classifier':''} ${compositePart?'uml-composite-part':''} ${compositeRole?'uml-composite-reference':''} ${compositePort?'uml-composite-port':''} ${compositeCollaboration?'uml-composite-collaboration':''} ${umlSequenceFrame?'uml-interaction-frame':''} ${umlInteractionRef?'uml-interaction-ref':''} ${umlStateNode?'uml-state-card':''} ${umlStateRegion?'uml-state-region':''} ${umlCommunicationParticipant?'uml-communication-participant':''} ${umlSequenceParticipant?'uml-sequence-participant':''} ${umlSequenceActivation?'uml-sequence-activation':''} ${umlSequenceDestruction?'uml-sequence-destruction':''} ${umlPackage&&data.nestingDepth?`uml-nested-level-${Math.min(2,Number(data.nestingDepth))}`:''} ${deployment?'uml-deployment-node':''} ${deployment&&Number(data.childrenCount||0)>0?'uml-deployment-container':''} ${ucRectangle?'uc-rectangle':''} ${selected?'selected':''}`}>
  {graphType.startsWith('uml-')&&!umlClass&&!umlMetaclass&&!umlStereotype&&!deployment&&!umlComponent&&!(umlPackage&&graphType==='uml-class'&&!data.childrenCount)&&!(umlPackage&&['uml-model','uml-profile'].includes(element.type))&&<span className="atlas-uml-type-identifier atlas-uml-type-corner">{uc?element.type==='actor'?(ucRectangle?'«actor»':'«Actor»'):'«Use Case»':umlTypeIdentifier(element)}</span>}
  {selected&&canResize&&<NodeResizer isVisible={true} minWidth={minWidth} minHeight={minHeight} maxWidth={4000} maxHeight={4000} keepAspectRatio={(activityDiagram||stateDiagram)&&['uml-decision','uml-start','uml-end','uml-flow-final'].includes(element.type)}
    color="#326ee7" handleClassName="atlas-node-resize-handle" lineClassName={(activityDiagram||stateDiagram)&&['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork'].includes(element.type)?'atlas-uml-symbol-resize-line':'atlas-node-resize-line'}
    onResizeEnd={(_,size)=>resizeCallback?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  {umlSubject&&data.ucAnnotationTarget===true&&<Handle id="uc-annotation" type="target" position={Position.Left} isConnectable={false} className="uc-internal-anchor" style={{opacity:0,pointerEvents:'none'}}/>}
  {!umlSubject&&<Handle id="left" type="source" position={Position.Left} className="node-handle" style={actorPortStyle('left')||(activityFourPorts?{left:activityPortInset}:undefined)} title="Conector izquierdo (entrada o salida)"/>}
  {!umlSubject&&(activityFourPorts||ucCardinal
    ?<Handle id="top-2" type="source" position={Position.Top} className="node-handle atlas-port-vertical" style={actorPortStyle('top')||{left:'50%',top:activityPortInset}} title="Conector superior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`top-${i}`} id={`top-${i+1}`} type="source" position={Position.Top} className="node-handle atlas-port-vertical" style={{left:`${pct}%`,...(activityBar?{top:'29%'}:{})}} title={`Conector superior ${i+1} (entrada o salida)`}/>))}
  {graphType==='uml-usecase'&&element.type==='actor'&&!ucRectangle&&<svg aria-label="Actor UML" className="uml-actor-figure" style={{width:glyph.width,height:glyph.height,top:glyph.top}} viewBox="0 0 40 55"><circle cx="20" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="M20 14 V34 M6 24 H34 M20 34 L8 51 M20 34 L32 51" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}

  {compositeClassifier?<><div className="uml-composite-header"><strong>{element.name}</strong><small>internal structure</small></div><div className="uml-composite-guidance">Partes, roles y puertos internos · mueve los elementos dentro</div></>:
  compositePart?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>{element.uml?.classifier||'Parte estructurada'} {element.summary||''}</small></div>:
  compositeRole?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>Rol de referencia · {element.uml?.classifier||'0..1'}</small></div>:
  compositePort?<><div className="node-top"><span className="node-kind"><IconFor type={element.type}/> Puerto UML</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}</>:
  compositeCollaboration?<div className="uml-composite-collaboration-title">{element.name}</div>:
  deployment?<><div className="uml-deployment-symbol"><DeviceIcon size={23}/><span>{element.type==='uml-node'?'«node»':element.type==='uml-device'?'«device»':element.type==='uml-execution'?'«executionEnvironment»':'«artifact»'}</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}{element.type==='uml-execution'&&deploymentIcon!=='generic'&&<span className="uml-runtime-kind">{deploymentIcon}</span>}</>:
  umlPackage&&graphType==='uml-class'?<><div className="uml-package-tab">{data.childrenCount?element.name:umlTypeIdentifier(element)}</div>{!data.childrenCount&&<div className="uml-package-title">{element.name}</div>}</>:
  umlPackage?<><div className="uml-package-tab">{element.type==='uml-profile'?'«profile»':element.type==='uml-model'?'«model»':element.type==='uml-subpackage'?'Subpaquete':data.nestingDepth?'Paquete anidado':'Paquete'}</div><div className="uml-package-title">{element.name}</div><div className="uml-package-note">{element.uml?.visibility?`Visibilidad: ${element.uml.visibility} · `:''}{String(data.childrenCount||0)} elementos contenidos · arrastra dentro o usa el Inspector</div></>:
  umlSubject?<div className="uml-subject-title">{element.useCaseDetail?.stereotype&&<small>«{element.useCaseDetail.stereotype}»</small>}{element.name}</div>:
  uc?<div className="uc-symbol-content">{ucRectangle&&element.type==='usecase'&&<svg className="uc-ellipse-icon" viewBox="0 0 32 20"><ellipse cx="16" cy="10" rx="15" ry="9" fill="none" stroke="currentColor"/></svg>}<>{element.useCaseDetail?.stereotype&&<small className="uc-stereotype">«{element.useCaseDetail.stereotype}»</small>}</><strong style={{fontStyle:(element.useCaseDetail?.abstract??element.uml?.abstract)?'italic':undefined}}>{element.name}</strong>{(element.useCaseDetail?.leaf??element.uml?.leaf)&&<small>{'{leaf}'}</small>}{element.type==='usecase'&&!!element.useCaseDetail?.extensionPoints?.length&&<div className="uc-extension-points"><b>extension points</b>{element.useCaseDetail.extensionPoints.map(p=><div key={p.id}>{p.name}{p.description?`: ${p.description}`:''}</div>)}</div>}{ucRectangle&&attributeLines.length>0&&<div className="uml-structural-compartment">{attributeLines.map(a=><div key={a.id} style={{textDecoration:a.static?'underline':undefined}}>{umlAttributeText(a,true,data.typeNames as Record<string,string>|undefined)}</div>)}</div>}{ucRectangle&&operationLines.length>0&&<div className="uml-structural-compartment">{operationLines.map(o=><div key={o.id} style={{textDecoration:o.static?'underline':undefined,fontStyle:o.abstract?'italic':undefined}}>{umlOperationTextResolved(o,data.typeNames as Record<string,string>|undefined)}</div>)}</div>}</div>:
  umlMetaclass?<><div className="uml-profile-stereotype">«metaclass»</div><strong className="node-title">{element.name}</strong></>:
  umlStereotype?<><div className="uml-profile-stereotype">«stereotype»</div><strong className="node-title">{element.name}</strong>{attributeLines.length>0&&<div className="uml-structural-compartment">{attributeLines.map(a=><div key={a.id}>{umlAttributeText(a)}</div>)}</div>}</>:
  umlClass?<><div className="uml-class-header"><small className="atlas-uml-type-identifier">{umlTypeIdentifier(element)}</small><strong style={{fontStyle:element.uml?.abstract?'italic':undefined}}>{element.name}</strong>{element.uml?.leaf&&<small>{'{leaf}'}</small>}{!!element.uml?.templateParameters?.length&&<span className="uml-template-parameters">{element.uml.templateParameters.map(p=>classTemplateFormalText(p,data.typeNames as Record<string,string>|undefined)).join(', ')}</span>}</div>{element.type==='uml-enumeration'&&!!element.uml?.literals?.length&&<div className="uml-structural-compartment" aria-label="Literales UML">{element.uml.literals.map(l=><div key={l.id}>{l.name}</div>)}</div>}{attributeLines.length>0&&<div className="uml-structural-compartment" aria-label="Atributos de la clase">{attributeLines.map(a=><div key={a.id} style={{textDecoration:a.static?'underline':undefined}}>{umlAttributeText(a,graphType==='uml-class',data.typeNames as Record<string,string>|undefined)}</div>)}</div>}{operationLines.length>0&&<div className="uml-structural-compartment" aria-label="Operaciones de la clase">{operationLines.map(o=><div key={o.id} style={{textDecoration:o.static?'underline':undefined,fontStyle:o.abstract?'italic':undefined}}>{graphType==='uml-class'?umlOperationTextResolved(o,data.typeNames as Record<string,string>|undefined):umlOperationText(o)}</div>)}</div>}</>:
  ['uml-class','uml-usecase'].includes(graphType)&&['uml-comment','uml-constraint'].includes(element.type)?<div className="uml-note-content">{element.type==='uml-constraint'?`{${element.uml?.expression||element.name}}`:element.uml?.note||element.name}</div>:
  umlObject?<><div className="uml-object-header">{umlObjectTitle(element.name,element.uml?.classifier)}</div><div className="uml-object-slots" aria-label="Valores de instancia">{slotLines.length?slotLines.map(s=><div key={s.id}>{s.name}{s.type?`: ${s.type}`:''} = {s.value}</div>):<span className="uml-compartment-empty">Sin valores de instancia</span>}</div></>:
  umlCommunicationParticipant?<div className="uml-communication-participant-box"><div className="uml-communication-title">{umlObjectTitle(element.name,element.uml?.classifier)}</div>{element.summary&&<small>{element.summary}</small>}</div>:
  umlDecision?<div className="uml-decision-shape" role="img" aria-label={stateDiagram?'Elección o unión UML: rombo':'Decisión o fusión UML: rombo'}><svg viewBox="0 0 84 84" preserveAspectRatio="none" aria-hidden="true"><polygon points="42,2 82,42 42,82 2,42" fill="#fff" stroke="currentColor" strokeWidth="2.5"/></svg></div>:
  umlFlowFinal?<div className="uml-pseudostate-notation" role="img" aria-label="Final de flujo UML: círculo con X"><svg className="uml-flow-final-symbol" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="23" stroke="currentColor" strokeWidth="2.8" fill="white"/><path d="M16 16L38 38M38 16L16 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/></svg></div>:
  umlPartition?<><div className="uml-partition-heading">{element.name}</div><div className="uml-partition-description">Partición de actividad · {String(data.childrenCount||0)} nodos</div></>:
  umlAction?<div className="uml-action-label">{element.name}</div>:
  umlObjectNode?<div className="uml-object-node-label"><span>{element.name}</span>{element.uml?.classifier&&<small>: {element.uml.classifier}</small>}</div>:
  umlFork?<div className="uml-fork-symbol" role="img" aria-label={stateDiagram?'Bifurcación o unión UML de máquina de estados':'Bifurcación o unión paralela UML'}/>:
  umlSequenceFrame?<div className={`uml-interaction-frame-shell ${sequenceDiagram?'uml-combined-fragment':''}`}><div className="uml-interaction-frame-tag">{interactionOperator}</div><div className="uml-interaction-frame-title">{element.name}</div>{sequenceDiagram?<div className="uml-fragment-operands">{combinedOperands.map((guard,i)=><div key={`${i}-${guard}`} className="uml-fragment-operand"><span>{guard.startsWith('[')?guard:`[${guard}]`}</span></div>)}</div>:element.summary&&<div className="uml-interaction-frame-summary">{element.summary}</div>}</div>:
  umlInteractionRef?<div className="uml-interaction-ref-shell"><div className="uml-interaction-ref-tag">ref</div><div className="uml-interaction-ref-title">{element.name}</div>{element.summary&&<div className="uml-interaction-ref-summary">{element.summary}</div>}</div>:
  umlStateRegion?<><div className="uml-state-region-title">{element.name}</div>{element.summary&&<div className="uml-state-region-caption">{element.summary}</div>}</>:
  umlStateNode?<div className="uml-state-shell"><div className="uml-state-name">{element.name}</div>{stateLines.length>0&&<div className="uml-state-compartment">{stateLines.map((line,index)=><div key={index}>{line}</div>)}</div>}</div>:
  umlSequenceActivation?<div className="uml-sequence-activation-shell" aria-label="Ejecución o activación UML" role="img"><div className="uml-sequence-activation-body"/></div>:
  umlSequenceDestruction?<div className="uml-sequence-destruction-shell" aria-label="Destrucción UML" role="img"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M 8 8 L 32 32 M 32 8 L 8 32" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg></div>:
  umlLifeline?<div className="uml-lifeline-notation"><div className="uml-lifeline-head">{element.name}</div><div className="uml-lifeline-tail" aria-hidden="true" style={typeof data.sequenceEndY==='number'?{height:Math.max(0,data.sequenceEndY-37),flex:'0 0 auto'}:undefined}/></div>:
  umlPseudostate?<div className="uml-pseudostate-notation" aria-label={element.type==='uml-start'?'Nodo inicial UML':'Nodo final UML'}><span className={element.type==='uml-start'?'uml-start-symbol':'uml-end-symbol'}/></div>:
  <>{umlComponent?<div className="uml-component-heading"><span>«component»</span><svg viewBox="0 0 30 28" width="26" height="25" aria-label="Símbolo UML de componente"><rect x="8" y="3" width="19" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="8" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="16" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/></svg></div>:<div className="node-top"><span className="node-kind"><IconFor type={element.type}/>{elementLabels[element.type]}</span>{element.childDiagramId&&<span className="node-drill" title={linkedDiagramType?`Doble clic para abrir ${diagramLabels[linkedDiagramType]}`:'Doble clic para abrir la vista vinculada'}>{linkedDiagramType?.startsWith('c')?<b>{linkedDiagramType.toUpperCase()}</b>:<Maximize2 size={11}/>}</span>}</div>}
  <div className="node-title">{element.name}</div>
  {mode!=='technical'&&element.summary&&<div className="node-summary">{element.summary}</div>}
  {technical&&element.technical&&<div className="node-tech"><Code2 size={12}/><span>{element.technical}</span></div>}
  {graphType==='trace'&&<span className="node-mini-label">{feature}</span>}</>}
  {!umlSubject&&<Handle id="right" type="source" position={Position.Right} className="node-handle" style={actorPortStyle('right')||(activityFourPorts?{right:activityPortInset}:undefined)} title="Conector derecho (entrada o salida)"/>}
  {!umlSubject&&(activityFourPorts||ucCardinal
    ?<Handle id="bottom-2" type="source" position={Position.Bottom} className="node-handle atlas-port-vertical" style={actorPortStyle('bottom')||{left:'50%',bottom:activityPortInset}} title="Conector inferior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`bottom-${i}`} id={`bottom-${i+1}`} type="source" position={Position.Bottom} className="node-handle atlas-port-vertical" style={{left:`${pct}%`,...(activityBar?{bottom:'29%'}:{})}} title={`Conector inferior ${i+1} (entrada o salida)`}/>))}
 </div>
}
export const nodeTypes={atlas:AtlasNode}
