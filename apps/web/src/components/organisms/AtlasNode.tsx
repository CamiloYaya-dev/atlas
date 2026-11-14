import {UserRound,Boxes,Database,Code2,BookOpen,FileText,Workflow,Cloud,Layers,Maximize2,Server,Monitor,Smartphone,HardDrive,Network,Box,Container} from 'lucide-react'
import {Handle,Position,NodeResizer} from '@xyflow/react'
import type {NodeProps} from '@xyflow/react'
import {diagramLabels,elementLabels,umlAttributeText,umlOperationText,umlObjectTitle,atlasNodeMinimum} from '@atlas/contracts'
import type {DiagramType,ModelElement,Perspective} from '@atlas/contracts'
export function IconFor({type}:{type:string}){switch(type){case 'actor':return <UserRound size={15}/>;case 'system':return <Boxes size={15}/>;case 'database':return <Database size={15}/>;case 'endpoint':return <Code2 size={15}/>;case 'requirement':return <BookOpen size={15}/>;case 'usecase':return <FileText size={15}/>;case 'process':case 'activity':return <Workflow size={15}/>;case 'external':return <Cloud size={15}/>;default:return <Layers size={15}/>}}
export function AtlasNode({id,data,selected}:NodeProps){
 const element=data.element as ModelElement|undefined;const mode=data.mode as Perspective;const graphType=data.graphType as DiagramType
 if(!element)return <div className="node missing">Elemento no disponible</div>
 const technical=mode!=='functional';const feature=diagramLabels[graphType];const linkedDiagramType=data.linkedDiagramType as DiagramType|undefined
 const umlClass=graphType.startsWith('uml-')&&graphType!=='uml-composite'&&['uml-class','uml-interface','uml-enumeration'].includes(element.type)
 const compositeClassifier=graphType==='uml-composite'&&element.type==='uml-class'
 const compositePort=graphType==='uml-composite'&&element.type==='uml-port'
 const compositePart=graphType==='uml-composite'&&element.type==='uml-part'
 const compositeRole=graphType==='uml-composite'&&element.type==='uml-reference-role'
 const compositeCollaboration=graphType==='uml-composite'&&element.type==='uml-collaboration'
 const deployment=graphType==='uml-deployment'
 const umlObject=graphType==='uml-object'&&element.type==='uml-object'
 const umlPackage=graphType.startsWith('uml-')&&element.type==='uml-package'
 const umlComponent=graphType==='uml-component'&&element.type==='component'
 const umlDecision=graphType==='uml-activity'&&element.type==='uml-decision'
 const umlFork=graphType==='uml-activity'&&element.type==='uml-fork'
 const umlLifeline=['uml-sequence','uml-communication','uml-timing'].includes(graphType)&&element.type==='uml-lifeline'
 const umlPseudostate=graphType.startsWith('uml-')&&['uml-start','uml-end'].includes(element.type)
 const attributeLines=element.uml?.attributes||[],operationLines=element.uml?.operations||[],slotLines=element.uml?.slots||[]
 const deploymentIcon=element.type==='uml-device'?(element.uml?.deviceIcon||'server'):element.type==='uml-execution'?(element.uml?.runtimeIcon||'generic'):'generic'
 const iconMap:Record<string,typeof Server>={server:Server,desktop:Monitor,android:Smartphone,mobile:Smartphone,network:Network,storage:HardDrive,docker:Container,jvm:Box,nodejs:Code2,database:Database,generic:Layers}
 const DeviceIcon=iconMap[deploymentIcon]||Layers
 const canResize=!!data.canResize
 const resizeCallback=data.onResize as ((nodeId:string,width:number,height:number,x?:number,y?:number)=>void)|undefined
 const {width:minWidth,height:minHeight}=atlasNodeMinimum(graphType,element.type)
 return <div className={`atlas-node kind-${element.type} ${graphType.startsWith('uml-')?'uml-diagram uml-diagram-'+graphType:''} ${umlClass?'uml-structural-class':''} {umlDecision?'uml-decision-card':''} {umlFork?'uml-fork-card':''} {umlLifeline?'uml-lifeline-card':''} {umlPseudostate?'uml-pseudostate-card':''} ${umlObject?'uml-instance-card':''} ${umlPackage?'uml-package-container':''} ${umlComponent?'uml-component-card':''} ${compositeClassifier?'uml-composite-classifier':''} ${compositePart?'uml-composite-part':''} ${compositeRole?'uml-composite-reference':''} ${compositePort?'uml-composite-port':''} ${compositeCollaboration?'uml-composite-collaboration':''} ${umlPackage&&data.nestingDepth?`uml-nested-level-${Math.min(2,Number(data.nestingDepth))}`:''} ${deployment?'uml-deployment-node':''} ${deployment&&Number(data.childrenCount||0)>0?'uml-deployment-container':''} ${selected?'selected':''}`}>
  {selected&&canResize&&<NodeResizer isVisible={true} minWidth={minWidth} minHeight={minHeight} maxWidth={4000} maxHeight={4000}
    color="#326ee7" handleClassName="atlas-node-resize-handle" lineClassName="atlas-node-resize-line"
    onResizeEnd={(_,size)=>resizeCallback?.(id,Math.round(size.width),Math.round(size.height),size.x,size.y)}/>}
  <Handle id="left" type="source" position={Position.Left} className="node-handle" title="Conector izquierdo (entrada o salida)"/>
  {[20,50,80].map((pct,i)=><Handle key={`top-${i}`} id={`top-${i+1}`} type="source" position={Position.Top} className="node-handle atlas-port-vertical" style={{left:`${pct}%`}} title={`Conector superior ${i+1} (entrada o salida)`}/>)}
  {graphType==='uml-usecase'&&element.type==='actor'&&<svg aria-label="Actor UML" className="uml-actor-figure" viewBox="0 0 40 55"><circle cx="20" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="M20 14 V34 M6 24 H34 M20 34 L8 51 M20 34 L32 51" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>}

  {compositeClassifier?<><div className="uml-composite-header"><strong>{element.name}</strong><small>internal structure</small></div><div className="uml-composite-guidance">Partes, roles y puertos internos · mueve los elementos dentro</div></>:
  compositePart?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>{element.uml?.classifier||'Parte estructurada'} {element.summary||''}</small></div>:
  compositeRole?<div className="uml-composite-part-content"><strong>{element.name}</strong><small>Rol de referencia · {element.uml?.classifier||'0..1'}</small></div>:
  compositePort?<><div className="node-top"><span className="node-kind"><IconFor type={element.type}/> Puerto UML</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}</>:
  compositeCollaboration?<div className="uml-composite-collaboration-title">{element.name}</div>:
  deployment?<><div className="uml-deployment-symbol"><DeviceIcon size={23}/><span>{element.type==='uml-node'?'«node»':element.type==='uml-device'?'«device»':element.type==='uml-execution'?'«executionEnvironment»':'«artifact»'}</span></div><strong className="node-title">{element.name}</strong>{element.summary&&<small className="node-summary">{element.summary}</small>}{element.type==='uml-execution'&&deploymentIcon!=='generic'&&<span className="uml-runtime-kind">{deploymentIcon}</span>}</>:
  umlPackage?<><div className="uml-package-tab">{data.nestingDepth?'Subpaquete':'Paquete'}</div><div className="uml-package-title">{element.name}</div><div className="uml-package-note">{String(data.childrenCount||0)} elementos contenidos · arrastra dentro o usa el Inspector</div></>:
  umlClass?<><div className="uml-class-header">{element.type==='uml-interface'&&<small>«interface»</small>}{element.type==='uml-enumeration'&&<small>«enumeration»</small>}<strong>{element.name}</strong></div><div className="uml-structural-compartment" aria-label="Atributos de la clase">{attributeLines.length?attributeLines.map(a=><div key={a.id}>{umlAttributeText(a)}</div>):<span className="uml-compartment-empty">Sin atributos</span>}</div><div className="uml-structural-compartment" aria-label="Operaciones de la clase">{operationLines.length?operationLines.map(o=><div key={o.id}>{umlOperationText(o)}</div>):<span className="uml-compartment-empty">Sin operaciones</span>}</div></>:
  umlObject?<><div className="uml-object-header">{umlObjectTitle(element.name,element.uml?.classifier)}</div><div className="uml-object-slots" aria-label="Valores de instancia">{slotLines.length?slotLines.map(s=><div key={s.id}>{s.name}{s.type?`: ${s.type}`:''} = {s.value}</div>):<span className="uml-compartment-empty">Sin valores de instancia</span>}</div></>:
  umlDecision?<div className="uml-decision-shape" aria-label="Decisión o unión UML"><svg viewBox="0 0 72 72" aria-hidden="true"><polygon points="36,3 69,36 36,69 3,36" fill="white" stroke="currentColor" strokeWidth="2.5"/></svg></div>:
  umlFork?<div className="uml-fork-symbol" role="img" aria-label="Bifurcación o unión paralela UML"/>:
  umlLifeline?<div className="uml-lifeline-notation"><div className="uml-lifeline-head">{element.name}</div><div className="uml-lifeline-tail" aria-hidden="true"/></div>:
  umlPseudostate?<div className="uml-pseudostate-notation" aria-label={element.type==='uml-start'?'Nodo inicial UML':'Nodo final UML'}><span className={element.type==='uml-start'?'uml-start-symbol':'uml-end-symbol'}/></div>:
  <>{umlComponent?<div className="uml-component-heading"><span>«component»</span><svg viewBox="0 0 30 28" width="26" height="25" aria-label="Símbolo UML de componente"><rect x="8" y="3" width="19" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="8" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="16" width="12" height="5" fill="white" stroke="currentColor" strokeWidth="1.5"/></svg></div>:<div className="node-top"><span className="node-kind"><IconFor type={element.type}/>{elementLabels[element.type]}</span>{element.childDiagramId&&<span className="node-drill" title={linkedDiagramType?`Doble clic para abrir ${diagramLabels[linkedDiagramType]}`:'Doble clic para abrir la vista vinculada'}>{linkedDiagramType?.startsWith('c')?<b>{linkedDiagramType.toUpperCase()}</b>:<Maximize2 size={11}/>}</span>}</div>}
  <div className="node-title">{element.name}</div>
  {mode!=='technical'&&element.summary&&<div className="node-summary">{element.summary}</div>}
  {technical&&element.technical&&<div className="node-tech"><Code2 size={12}/><span>{element.technical}</span></div>}
  {graphType==='trace'&&<span className="node-mini-label">{feature}</span>}</>}
  <Handle id="right" type="source" position={Position.Right} className="node-handle" title="Conector derecho (entrada o salida)"/>
  {[20,50,80].map((pct,i)=><Handle key={`bottom-${i}`} id={`bottom-${i+1}`} type="source" position={Position.Bottom} className="node-handle atlas-port-vertical" style={{left:`${pct}%`}} title={`Conector inferior ${i+1} (entrada o salida)`}/>)}
 </div>
}
export const nodeTypes={atlas:AtlasNode}
