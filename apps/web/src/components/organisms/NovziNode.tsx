import {deploymentPort} from '@novzi/contracts'
import {activityNodeLabel,activitySymbol,activityPorts} from '@novzi/contracts'
import {umlTypeIdentifier,classTemplateFormalText,UC_ACTOR_GLYPH} from '@novzi/contracts'
import {UserRound,Boxes,Database,Code2,BookOpen,FileText,Workflow,Cloud,Layers,Maximize2,Server,Monitor,Smartphone,HardDrive,Network,Box,Container} from 'lucide-react'
import {Handle,Position,NodeResizer,useUpdateNodeInternals} from '@xyflow/react'
import {useEffect,useRef,useState} from 'react'
import type {NodeProps} from '@xyflow/react'
import {diagramLabels,elementLabels,umlAttributeText,umlOperationText,umlOperationTextResolved,umlObjectTitle,novziNodeMinimum,sequenceActivationPorts} from '@novzi/contracts'
import type {DiagramType,ModelElement,Perspective} from '@novzi/contracts'
export function IconFor({type}:{type:string}){switch(type){case 'actor':return <UserRound size={15}/>;case 'system':return <Boxes size={15}/>;case 'database':return <Database size={15}/>;case 'endpoint':return <Code2 size={15}/>;case 'requirement':return <BookOpen size={15}/>;case 'usecase':return <FileText size={15}/>;case 'process':case 'activity':return <Workflow size={15}/>;case 'external':return <Cloud size={15}/>;default:return <Layers size={15}/>}}
/**
 * UML control / pseudostate nodes are symbols, not cards. Render them outside
 * the generic card tree so legacy .uml-diagram.kind-* CSS cannot accidentally
 * add a background, a second diamond or an outline. Ports stay attached to the
 * real contour of the symbol and preserve the historical ids saved in NOVZI.
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
  <Handle id="left" type="source" position={Position.Left} className="node-handle novzi-sequence-symbol-port" style={{left:'35.42%',top:'50%'}} title="Mensaje UML lateral izquierdo"/>
  <Handle id="right" type="source" position={Position.Right} className="node-handle novzi-sequence-symbol-port" style={{right:'35.42%',top:'50%'}} title="Mensaje UML lateral derecho"/>
  {ports.map(p=><Handle key={p.id} id={p.id} type="source" position={p.side==='left'?Position.Left:Position.Right} className="node-handle novzi-sequence-symbol-port" style={{[p.side]:'35.42%',top:`${p.topPercent}%`}} title={`Mensaje ${p.side==='left'?'izquierdo':'derecho'} · ${p.topPercent}%`}/>) }
 </>
}
/**
 * React Flow caches node/handle geometry. Re-measure once the active perspective
 * finishes laying out, and when content or fonts change its actual card height.
 * This updates only connection anchors; it NEVER persists a resize/version.
 */
function AdaptiveCardPortSync({nodeId,perspective}:{nodeId:string;perspective:Perspective}){
 const marker=useRef<HTMLSpanElement>(null)
 const updateNodeInternals=useUpdateNodeInternals()
 useEffect(()=>{
  const card=marker.current?.parentElement
  if(!card)return
  let frame:number|undefined
  const schedule=()=>{
   if(typeof requestAnimationFrame==='function'){
    if(frame!==undefined)cancelAnimationFrame(frame)
    frame=requestAnimationFrame(()=>updateNodeInternals(nodeId))
   }else{updateNodeInternals(nodeId)}
  }
  schedule()
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):undefined
  observer?.observe(card)
  return ()=>{observer?.disconnect();if(frame!==undefined)cancelAnimationFrame(frame)}
 },[nodeId,perspective,updateNodeInternals])
 return <span ref={marker} aria-hidden="true" style={{display:'none'}}/>
}
function UmlControlSymbol({id,graphType,kind,selected,canResize,onResize,activationHeight,activityElement}:{
 id:string;graphType:DiagramType;kind:string;selected:boolean;canResize:boolean;activationHeight?:number;activityElement?:ModelElement;
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
 const vertical=activity&&isBar&&activityElement?.activityDetail?.orientation==='vertical'
 const minGraph=(activity?'uml-activity':state?'uml-state':'uml-sequence') as DiagramType
 const minimum=novziNodeMinimum(minGraph,kind as ModelElement['type']);const minWidth=vertical?48:minimum.width,minHeight=vertical?90:minimum.height
 const portClass=sequence?'novzi-sequence-symbol-port':'novzi-activity-symbol-port'
 const port=(portId:string,position:Position,style?:Record<string,string>)=><Handle
  key={portId} id={portId} type="source" position={position} className={`node-handle ${portClass}`}
  style={style} title={`Conector UML ${portId}`}/>
 const tip=isCircle?'6%':isDecision?'2.4%':isTerminate?'1%':undefined
 // Activation messages attach ONLY to its lateral edges, at many heights.
 // Width of the visible UML bar is 14/48 units; inset each connection to it.
 // Preserve historical left/right handle ids for already persisted messages.
 const pct=(v:number)=>`${Math.round(v*1000)/10}%`
 const ports=activityElement?activityPorts(activityElement).map(p=>port(p.id,({left:Position.Left,right:Position.Right,top:Position.Top,bottom:Position.Bottom})[p.side],p.side==='left'?{left:pct(p.x),...(p.y!==.5?{top:pct(p.y)}:{})}:p.side==='right'?{right:pct(1-p.x),...(p.y!==.5?{top:pct(p.y)}:{})}:p.side==='top'?{left:pct(p.x),top:pct(p.y)}:{left:pct(p.x),bottom:pct(1-p.y)})):isActivation?[]:[
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
 return <div className={`novzi-uml-control graph-${graphType} ${isDecision?'uml-decision-card':''} ${isBar?'uml-fork-card':''} ${isCircle?'uml-pseudostate-card':''} ${kind==='uml-flow-final'?'uml-activity-flow-final':''} ${isActivation?'uml-sequence-activation-card':''} ${isDestruction?'uml-sequence-destruction-card':''} kind-${kind} ${selected?'selected':''}`}>
  {selected&&canResize&&<NodeResizer isVisible minWidth={minWidth} minHeight={minHeight}
   maxWidth={4000} maxHeight={4000} keepAspectRatio={isCircle||isDecision||isDestruction||isTerminate}
   color="#326ee7" handleClassName="novzi-uml-symbol-resize-handle" lineClassName="novzi-uml-symbol-resize-line"
   onResizeEnd={(_,size)=>onResize?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  {isDecision?<svg className="uml-decision-shape uml-control-glyph" viewBox="0 0 84 84" preserveAspectRatio="none" role="img" aria-label={label}>
    <polygon points="42,2 82,42 42,82 2,42" fill="white" stroke="#405a80" strokeWidth="2.5"/>
   </svg>:
   isBar?<svg className="uml-fork-symbol uml-control-glyph" viewBox={vertical?'0 0 28 160':'0 0 160 28'} preserveAspectRatio="none" role="img" aria-label={label}>
    {vertical?<rect x="8.12" y="2" width="11.76" height="156" rx="1" fill="#1e2741"/>:<rect x="2" y={activity?8.12:9} width="156" height={activity?11.76:10} rx="1" fill="#1e2741"/>}
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
  {activity&&activityElement&&<span className="activity-control-identifier">«{activityNodeLabel(activityElement)}»</span>}
  {isActivation?<ActivationHandles id={id} height={activationHeight||120}/>:ports}
 </div>
}

export function ExecutionTimeAction({id,times,onAdjust}:{id:string;times:{start:number;finish:number};onAdjust:(id:string,start:number,finish:number,expected:{start:number;finish:number})=>void}){
 const [open,setOpen]=useState(false),[start,setStart]=useState(''),[finish,setFinish]=useState(''),[expected,setExpected]=useState(times);
 return <div className="nodrag nopan" style={{position:'absolute',left:'100%',top:0,zIndex:20,minWidth:open?210:130,padding:4,background:'white',border:'1px solid #abb8c9',borderRadius:5,color:'#344965'}} onPointerDown={e=>e.stopPropagation()}>{!open?<button type="button" onClick={()=>{setExpected(times);setStart(String(times.start));setFinish(String(times.finish));setOpen(true)}}>Ajustar tiempo</button>:<><strong>Ajustar límites temporales</strong><label style={{display:'block'}}>Inicio<input aria-label="Inicio temporal" type="number" min="0" value={start} onChange={e=>setStart(e.target.value)} style={{width:85}}/></label><label style={{display:'block'}}>Fin<input aria-label="Fin temporal" type="number" min="0" value={finish} onChange={e=>setFinish(e.target.value)} style={{width:85}}/></label><button type="button" disabled={!start||!finish||!Number.isFinite(Number(start))||!Number.isFinite(Number(finish))} onClick={()=>{setOpen(false);onAdjust(id,Number(start),Number(finish),expected)}}>Revisar ajuste</button><button type="button" onClick={()=>setOpen(false)}>Cancelar</button></>}</div>
}
function SequenceSemanticNode({id,data,element,selected}:{id:string;data:NodeProps['data'];element:ModelElement;selected:boolean}){
 const size=data.sequenceSize as {width:number;height:number};const update=useUpdateNodeInternals();useEffect(()=>update(id),[id,size.width,size.height,update]);const bound=['uml-activation','uml-destruction','uml-gate','uml-sequence-invariant'].includes(element.type),frame=['uml-frame','uml-interaction'].includes(element.type),line=['uml-lifeline','actor'].includes(element.type);const resize=data.onResize as ((id:string,w:number,h:number,x?:number,y?:number)=>void)|undefined;const min=novziNodeMinimum('uml-sequence',element.type)
 return <div className={`novzi-sequence-semantic kind-${element.type} ${selected?'selected':''}`} aria-label={`${elementLabels[element.type]} ${element.name}`} style={{width:'100%',height:'100%',position:'relative'}}><svg role="img" aria-label={elementLabels[element.type]} width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} style={{overflow:'visible'}} dangerouslySetInnerHTML={{__html:String(data.sequenceGlyph)}}/>{selected&&!!data.canResize&&(data.sequencePositionLocked===false||!bound&&!data.sequencePositionLocked)&&element.type!=='uml-destruction'&&<NodeResizer minWidth={min.width} minHeight={min.height} maxWidth={4000} maxHeight={4000} onResizeEnd={(_,v)=>resize?.(id,Math.round(v.width),Math.round(v.height),v.x,v.y)}/>}{selected&&!!data.canResize&&!!data.onAdjustExecution&&data.executionTimes&&Number.isFinite((data.executionTimes as {start:number}).start)&&Number.isFinite((data.executionTimes as {finish:number}).finish)?<ExecutionTimeAction id={id} times={data.executionTimes as {start:number;finish:number}} onAdjust={data.onAdjustExecution as (id:string,start:number,finish:number,expected:{start:number;finish:number})=>void}/>:null}{element.type==='uml-activation'?<ActivationHandles id={id} height={size.height}/>:!frame&&<>{['left','right'].map(side=><Handle key={side} id={side} type="source" position={side==='left'?Position.Left:Position.Right} style={{left:line||bound?'50%':side==='left'?'0%':'100%',right:'auto',top:'50%'}} className="node-handle" title={`Ocurrencia ${side}`}/>)}{line&&sequenceActivationPorts(size.height).map(p=><Handle id={p.id} key={p.id} type="source" position={p.side==='left'?Position.Left:Position.Right} style={{left:'50%',right:'auto',top:`${Math.max(38/size.height*100,p.topPercent)}%`}} className="node-handle" title="Posición de ocurrencia"/>)}</>}</div>
}
function ComponentSemanticNode({id,data,element,selected}:{id:string;data:NodeProps['data'];element:ModelElement;selected:boolean}){const size=data.componentSize as {width:number;height:number},port=element.type==='uml-port',resize=data.onResize as ((id:string,w:number,h:number,x?:number,y?:number)=>void)|undefined;const depStyle=(handle:string)=>{if(!data.deploymentCube)return undefined;const p=deploymentPort({x:0,y:0,...size},true,handle,true);return p.side==='left'?{left:p.x,top:p.y}:p.side==='right'?{right:size.width-p.x,top:p.y}:p.side==='top'?{left:p.x,top:p.y}:{left:p.x,bottom:size.height-p.y}};const min=novziNodeMinimum(data.graphType as DiagramType,element.type),update=useUpdateNodeInternals();useEffect(()=>update(id),[id,size.width,size.height,update]);return <div className={`novzi-component-semantic ${selected?'selected':''}`} style={{width:'100%',height:'100%',position:'relative'}} aria-label={`${elementLabels[element.type]} ${element.name}`}><svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} style={{overflow:'visible'}} dangerouslySetInnerHTML={{__html:String(data.componentGlyph)}}/>{selected&&!!data.canResize&&!port&&<NodeResizer minWidth={min.width} minHeight={min.height} maxWidth={4000} maxHeight={4000} onResizeEnd={(_,v)=>resize?.(id,Math.round(v.width),Math.round(v.height),v.x,v.y)}/>}<Handle id="left" type="source" position={Position.Left} style={depStyle('left')} className="node-handle"/><Handle id="right" type="source" position={Position.Right} style={depStyle('right')} className="node-handle"/>{(port?[50]:[20,50,80]).map((pct,i)=><Handle key={`top${i}`} id={`top-${port?2:i+1}`} type="source" position={Position.Top} style={depStyle(`top-${port?2:i+1}`)||{left:`${pct}%`}} className="node-handle novzi-port-vertical"/>)}{(port?[50]:[20,50,80]).map((pct,i)=><Handle key={`bottom${i}`} id={`bottom-${port?2:i+1}`} type="source" position={Position.Bottom} style={depStyle(`bottom-${port?2:i+1}`)||{left:`${pct}%`}} className="node-handle novzi-port-vertical"/>)}</div>}
export function NovziNode({id,data,selected}:NodeProps){
 const element=data.element as ModelElement|undefined;const mode=data.mode as Perspective;const graphType=data.graphType as DiagramType
 if(!element)return <div className="node missing">Elemento no disponible</div>
 if(['uml-component','uml-deployment'].includes(graphType)&&typeof data.componentGlyph==='string')return <ComponentSemanticNode id={id} data={data} element={element} selected={!!selected}/>
 if(graphType==='uml-sequence'&&typeof data.sequenceGlyph==='string')return <SequenceSemanticNode id={id} data={data} element={element} selected={!!selected}/>
 // UML symbol nodes must bypass the generic card renderer entirely.
 if((data.graphType==='uml-activity'&&ACTIVITY_CONTROL_TYPES.has(element.type))||
    (data.graphType==='uml-state'&&STATE_CONTROL_TYPES.has(element.type))||
    (data.graphType==='uml-sequence'&&SEQUENCE_SYMBOL_TYPES.has(element.type)))
  return <UmlControlSymbol id={id} graphType={data.graphType as DiagramType} kind={element.type} selected={!!selected}
    activityElement={data.graphType==='uml-activity'?element:undefined} activationHeight={typeof data.sequenceActivationHeight==='number'?data.sequenceActivationHeight:undefined}
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
 const umlPartition=activityDiagram&&['uml-partition','uml-activity-interruptible-region'].includes(element.type)
 const activityPin=activityDiagram&&element.type==='uml-activity-pin',activityParameter=activityDiagram&&element.type==='uml-activity-parameter',activitySpecial=activityDiagram?activitySymbol(element):undefined
 const hidePorts=umlSubject||umlPartition
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
 const activityFourPorts=activityPin||(activityDiagram||stateDiagram)&&['uml-start','uml-end','uml-flow-final','uml-decision'].includes(element.type)
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
 // Non-UML cards grow in the active perspective without changing saved dimensions.
 const adaptiveCard=!graphType.startsWith('uml-')&&data.adaptiveCard===true
 const cardMinHeight=adaptiveCard&&typeof data.cardMinHeight==='number'?data.cardMinHeight:undefined
 const canResize=!!data.canResize
 const resizeCallback=data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined
 const {width:minWidth,height:minHeight}=novziNodeMinimum(graphType,element.type)
 return <div className={`novzi-node kind-${element.type} ${graphType.startsWith('uml-')?'uml-diagram uml-diagram-'+graphType:''} ${umlClass?'uml-structural-class':''} ${umlDecision?'uml-decision-card':''} ${umlFork?'uml-fork-card':''} ${umlLifeline?'uml-lifeline-card':''} ${umlPseudostate?'uml-pseudostate-card':''} ${umlObject?'uml-instance-card':''} ${umlPackage?'uml-package-container':''} ${umlSubject?'uml-usecase-subject':''} ${umlMetaclass?'uml-metaclass-card':''} ${umlStereotype?'uml-stereotype-card':''} ${umlComponent?'uml-component-card':''} ${compositeClassifier?'uml-composite-classifier':''} ${compositePart?'uml-composite-part':''} ${compositeRole?'uml-composite-reference':''} ${compositePort?'uml-composite-port':''} ${compositeCollaboration?'uml-composite-collaboration':''} ${umlSequenceFrame?'uml-interaction-frame':''} ${umlInteractionRef?'uml-interaction-ref':''} ${umlStateNode?'uml-state-card':''} ${umlStateRegion?'uml-state-region':''} ${umlCommunicationParticipant?'uml-communication-participant':''} ${umlSequenceParticipant?'uml-sequence-participant':''} ${umlSequenceActivation?'uml-sequence-activation':''} ${umlSequenceDestruction?'uml-sequence-destruction':''} ${umlPackage&&data.nestingDepth?`uml-nested-level-${Math.min(2,Number(data.nestingDepth))}`:''} ${deployment?'uml-deployment-node':''} ${deployment&&Number(data.childrenCount||0)>0?'uml-deployment-container':''} ${ucRectangle?'uc-rectangle':''} ${selected?'selected':''} ${adaptiveCard?'novzi-adaptive-card':''}`} style={adaptiveCard?{'--novzi-card-min-height':`${cardMinHeight??65}px`} as React.CSSProperties:undefined}>
  {adaptiveCard&&<AdaptiveCardPortSync nodeId={id} perspective={mode}/>}
  {graphType.startsWith('uml-')&&!umlClass&&!umlMetaclass&&!umlStereotype&&!deployment&&!umlComponent&&!(umlPackage&&graphType==='uml-class'&&!data.childrenCount)&&!(umlPackage&&['uml-model','uml-profile'].includes(element.type))&&<span className="novzi-uml-type-identifier novzi-uml-type-corner">{uc?element.type==='actor'?(ucRectangle?'«actor»':'«Actor»'):'«Use Case»':umlTypeIdentifier(element)}</span>}
  {selected&&canResize&&<NodeResizer isVisible={true} minWidth={minWidth} minHeight={minHeight} maxWidth={4000} maxHeight={4000} keepAspectRatio={(activityDiagram||stateDiagram)&&['uml-decision','uml-start','uml-end','uml-flow-final'].includes(element.type)}
    color="#326ee7" handleClassName="novzi-node-resize-handle" lineClassName={(activityDiagram||stateDiagram)&&['uml-start','uml-end','uml-flow-final','uml-decision','uml-fork'].includes(element.type)?'novzi-uml-symbol-resize-line':'novzi-node-resize-line'}
    onResizeEnd={(_,size)=>resizeCallback?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  {umlSubject&&data.ucAnnotationTarget===true&&<Handle id="uc-annotation" type="target" position={Position.Left} isConnectable={false} className="uc-internal-anchor" style={{opacity:0,pointerEvents:'none'}}/>}
  {!hidePorts&&<Handle id="left" type="source" position={Position.Left} className="node-handle" style={actorPortStyle('left')||(activityFourPorts?{left:activityPortInset}:undefined)} title="Conector izquierdo (entrada o salida)"/>}
  {!hidePorts&&(activityFourPorts||ucCardinal
    ?<Handle id="top-2" type="source" position={Position.Top} className="node-handle novzi-port-vertical" style={actorPortStyle('top')||{left:'50%',top:activityPortInset}} title="Conector superior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`top-${i}`} id={`top-${i+1}`} type="source" position={Position.Top} className="node-handle novzi-port-vertical" style={{left:`${pct}%`,...(activityBar?{top:'29%'}:{})}} title={`Conector superior ${i+1} (entrada o salida)`}/>))}
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
  umlClass?<><div className="uml-class-header"><small className="novzi-uml-type-identifier">{umlTypeIdentifier(element)}</small><strong style={{fontStyle:element.uml?.abstract?'italic':undefined}}>{element.name}</strong>{element.uml?.leaf&&<small>{'{leaf}'}</small>}{!!element.uml?.templateParameters?.length&&<span className="uml-template-parameters">{element.uml.templateParameters.map(p=>classTemplateFormalText(p,data.typeNames as Record<string,string>|undefined)).join(', ')}</span>}</div>{element.type==='uml-enumeration'&&!!element.uml?.literals?.length&&<div className="uml-structural-compartment" aria-label="Literales UML">{element.uml.literals.map(l=><div key={l.id}>{l.name}</div>)}</div>}{attributeLines.length>0&&<div className="uml-structural-compartment" aria-label="Atributos de la clase">{attributeLines.map(a=><div key={a.id} style={{textDecoration:a.static?'underline':undefined}}>{umlAttributeText(a,graphType==='uml-class',data.typeNames as Record<string,string>|undefined)}</div>)}</div>}{operationLines.length>0&&<div className="uml-structural-compartment" aria-label="Operaciones de la clase">{operationLines.map(o=><div key={o.id} style={{textDecoration:o.static?'underline':undefined,fontStyle:o.abstract?'italic':undefined}}>{graphType==='uml-class'?umlOperationTextResolved(o,data.typeNames as Record<string,string>|undefined):umlOperationText(o)}</div>)}</div>}</>:
  ['uml-class','uml-usecase','uml-activity'].includes(graphType)&&['uml-comment','uml-constraint'].includes(element.type)?<div className="uml-note-content">{element.type==='uml-constraint'?`{${element.uml?.expression||element.name}}`:element.uml?.note||element.name}</div>:
  umlObject?<><div className="uml-object-header">{umlObjectTitle(element.name,element.uml?.classifier)}</div><div className="uml-object-slots" aria-label="Valores de instancia">{slotLines.length?slotLines.map(s=><div key={s.id}>{s.name}{s.type?`: ${s.type}`:''} = {s.value}</div>):<span className="uml-compartment-empty">Sin valores de instancia</span>}</div></>:
  umlCommunicationParticipant?<div className="uml-communication-participant-box"><div className="uml-communication-title">{umlObjectTitle(element.name,element.uml?.classifier)}</div>{element.summary&&<small>{element.summary}</small>}</div>:
  umlDecision?<div className="uml-decision-shape" role="img" aria-label={stateDiagram?'Elección o unión UML: rombo':'Decisión o fusión UML: rombo'}><svg viewBox="0 0 84 84" preserveAspectRatio="none" aria-hidden="true"><polygon points="42,2 82,42 42,82 2,42" fill="#fff" stroke="currentColor" strokeWidth="2.5"/></svg></div>:
  umlFlowFinal?<div className="uml-pseudostate-notation" role="img" aria-label="Final de flujo UML: círculo con X"><svg className="uml-flow-final-symbol" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="23" stroke="currentColor" strokeWidth="2.8" fill="white"/><path d="M16 16L38 38M38 16L16 38" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/></svg></div>:
  umlPartition?<><div className="uml-partition-heading"><small className="novzi-uml-type-identifier">«{activityNodeLabel(element)}»</small> {element.name}</div></>:
  umlAction?<div className="uml-action-label">{activitySpecial&&<svg className="activity-special-symbol" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={activitySpecial} fill="white" stroke="currentColor" strokeWidth="1"/></svg>}<small className="novzi-uml-type-identifier">«{activityNodeLabel(element)}»</small><span>{element.name}</span>{!!data.activityMembership&&<small>{String(data.activityMembership)}</small>}{element.activityDetail?.kind==='callBehavior'&&<span className="activity-rake">≋</span>}{(element.activityDetail?.precondition||element.activityDetail?.postcondition)&&<div className="activity-condition-notes">{element.activityDetail.precondition&&<small>«localPrecondition» {element.activityDetail.precondition}</small>}{element.activityDetail.postcondition&&<small>«localPostcondition» {element.activityDetail.postcondition}</small>}</div>}</div>:
  umlObjectNode?<div className="uml-object-node-label"><small className="novzi-uml-type-identifier">«{activityNodeLabel(element)}»</small><span>{element.name}</span><small>{element.activityDetail?.typeId?(data.typeNames as Record<string,string>|undefined)?.[element.activityDetail.typeId]:element.activityDetail?.externalType||element.uml?.classifier}</small>{element.activityDetail?.inState?.map(state=><small key={state}>[{state}]</small>)}</div>:activityPin||activityParameter?<div className="activity-pin-label"><small className="novzi-uml-type-identifier">«{activityNodeLabel(element)}»</small><span>{String(data.activityParameterLabel||element.name)}</span>{(data.activityParameter as {stream?:boolean;exception?:boolean}|undefined)?.stream&&<small>{'{stream}'}</small>}{(data.activityParameter as {stream?:boolean;exception?:boolean}|undefined)?.exception&&<small>△ excepción</small>}</div>:
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
  {!hidePorts&&<Handle id="right" type="source" position={Position.Right} className="node-handle" style={actorPortStyle('right')||(activityFourPorts?{right:activityPortInset}:undefined)} title="Conector derecho (entrada o salida)"/>}
  {!hidePorts&&(activityFourPorts||ucCardinal
    ?<Handle id="bottom-2" type="source" position={Position.Bottom} className="node-handle novzi-port-vertical" style={actorPortStyle('bottom')||{left:'50%',bottom:activityPortInset}} title="Conector inferior (punta del símbolo UML)"/>
    :[20,50,80].map((pct,i)=><Handle key={`bottom-${i}`} id={`bottom-${i+1}`} type="source" position={Position.Bottom} className="node-handle novzi-port-vertical" style={{left:`${pct}%`,...(activityBar?{bottom:'29%'}:{})}} title={`Conector inferior ${i+1} (entrada o salida)`}/>))}
 </div>
}
export const nodeTypes={novzi:NovziNode,'activity-frame':({data}:NodeProps)=><div className="novzi-activity-frame"><span>{String(data.label||'Actividad')}</span></div>}
