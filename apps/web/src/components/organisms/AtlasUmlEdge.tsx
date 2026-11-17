import type {sequenceEdgeGeometry} from '@atlas/contracts'
/** UML 2.5.1: símbolos geométricos explícitos en los extremos del conector.
 * No usamos markerStart/markerEnd de React Flow para UML: un rombo o socket
 * no es una flecha genérica y su orientación depende del PUERTO conectado.
 */
import {BaseEdge,EdgeLabelRenderer} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle,UmlTerminal,DiagramType,ElementType} from '@atlas/contracts'
import {umlRelationNotation,classRelationRoute,activityInterruptPath,activityExceptionRoute,classEndTerminal,classEndLabel} from '@atlas/contracts'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'
import {assemblyAnchor} from './uml-assembly'
export type UmlEdgeData={componentAssembly?:'forward'|'reverse';sequenceGeometry?:ReturnType<typeof sequenceEdgeGeometry>;activityInterrupted?:boolean;parallelOffset:number;parallelPath:EdgePathStyle;relationKind?:string;diagramType?:DiagramType;sourceElementType?:ElementType;targetElementType?:ElementType;sourceMultiplicity?:string;targetMultiplicity?:string;sourceRole?:string;targetRole?:string;wholeEnd?:'source'|'target';sourceNavigability?:'navigable'|'non-navigable'|'unspecified';targetNavigability?:'navigable'|'non-navigable'|'unspecified';extraEnds?:{id:string;x:number;y:number;label:string;side?:'top'|'bottom'|'left'|'right';navigability?:'navigable'|'non-navigable'|'unspecified'}[];semanticDisplayLabel?:string;extensionNote?:string[];associationClassPoint?:{x:number;y:number};annotationPoint?:{x:number;y:number}}
const INK='#506986'
export function terminalAngle(side:string|undefined,x:number,y:number,otherX:number,otherY:number):number{
 // Vector hacia AFUERA del nodo. En izquierda/derecha se mantiene horizontal;
 // en puertos superiores/inferiores se mantiene vertical.
 if(side==='right')return 0
 if(side==='left')return 180
 if(side==='top')return -90
 if(side==='bottom')return 90
 return Math.atan2(otherY-y,otherX-x)*180/Math.PI
}
/** Compatibilidad de API con pruebas anteriores, pero la fuente de verdad es
 * la tabla UML_NOTATION compartida con el backend. */
export function umlRelationAdornment(kind:string){
 const n=umlRelationNotation(kind)
 const start=n.start==='diamond-filled'?'composition':n.start==='diamond-open'?'aggregation':n.start
 const end=n.end==='triangle'?'triangle':n.end==='assembly'?'ball-socket':n.end
 return {start,end,dash:n.stroke==='dashed'}
}
export function Terminal({kind,x,y,angle}:{kind:UmlTerminal;x:number;y:number;angle:number}){
 if(kind==='none'||kind==='assembly')return null
 return <g data-uml-terminal={kind} transform={`translate(${x},${y}) rotate(${angle})`} pointerEvents="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
  {kind==='diamond-open'&&<polygon points="0,0 10,-7 20,0 10,7" fill="white"/>}
  {kind==='diamond-filled'&&<polygon points="0,0 10,-7 20,0 10,7" fill={INK}/>}
  {kind==='triangle'&&<polygon points="0,0 18,-10 18,10" fill="white"/>}
  {kind==='extension'&&<polygon points="0,0 18,-9 18,9" fill={INK}/>}
  {kind==='open-arrow'&&<path d="M 14,-7 L 0,0 L 14,7" fill="none"/>}
  {kind==='filled-arrow'&&<polygon points="0,0 15,-7 15,7" fill={INK}/>}
  {kind==='ball'&&<circle cx="8" cy="0" r="7" fill="white"/>}
  {kind==='socket'&&<path d="M 5,-10 Q 21,0 5,10" fill="none"/>}
  {kind==='ownership'&&<><circle cx="7" cy="0" r="7" fill="white"/><path d="M 2,0 H 12 M 7,-5 V 5"/></>}
  {kind==='cross'&&<path d="M -8,-8 L 8,8 M -8,8 L 8,-8" strokeWidth={2.6}/>}
 </g>
}
export function AtlasUmlEdge(props:EdgeProps){
 const data=(props.data||{}) as Partial<UmlEdgeData>
 const seq=data.sequenceGeometry
 if(seq)return <><BaseEdge id={props.id} path={seq.path} style={{stroke:INK,strokeWidth:1.5,strokeDasharray:seq.dash,fill:'none'}} interactionWidth={24}/><g pointerEvents="none" dangerouslySetInnerHTML={{__html:seq.marks}}/>{seq.label&&<EdgeLabelRenderer><div className="atlas-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${seq.labelX}px,${seq.labelY}px)`}}>{seq.label}</div></EdgeLabelRenderer>}</>
 const n=umlRelationNotation(data.relationKind||'association')
 const displayLabel=n.label?(data.semanticDisplayLabel?.startsWith(n.label)?data.semanticDisplayLabel:n.label):props.label
 const input={sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,sourcePosition:props.sourcePosition,targetPosition:props.targetPosition,offset:data.parallelOffset||0,pathStyle:data.parallelPath||'straight' as const}
 const exception=data.diagramType==='uml-activity'&&data.relationKind==='exception-handler'
 const route=exception?activityExceptionRoute({x:props.sourceX,y:props.sourceY,side:props.sourcePosition},{x:props.targetX,y:props.targetY,side:props.targetPosition}):['uml-class','uml-usecase','uml-activity','uml-component','uml-deployment'].includes(data.diagramType||'')?classRelationRoute(input,props.source===props.target):parallelRoute(input)
 const terminal=(side:'source'|'target'):UmlTerminal=>['uml-class','uml-usecase','uml-deployment'].includes(data.diagramType||'')?classEndTerminal(data,side):side==='source'?n.start:n.end
 const sourceLabel=['uml-class','uml-usecase','uml-deployment'].includes(data.diagramType||'')?classEndLabel({x:props.sourceX,y:props.sourceY},props.sourcePosition):{x:props.sourceX+20,y:props.sourceY-15}
 const targetLabel=['uml-class','uml-usecase','uml-deployment'].includes(data.diagramType||'')?classEndLabel({x:props.targetX,y:props.targetY},props.targetPosition):{x:props.targetX-20,y:props.targetY-15}
 const nary=!!data.extraEnds?.length,hub={x:route.labelX,y:route.labelY}
 const actualPath=data.annotationPoint?`M ${props.sourceX} ${props.sourceY} L ${data.annotationPoint.x} ${data.annotationPoint.y}`:nary?`M ${props.sourceX} ${props.sourceY} L ${hub.x} ${hub.y} L ${props.targetX} ${props.targetY}`:route.path
 const sa=terminalAngle(props.sourcePosition,props.sourceX,props.sourceY,props.targetX,props.targetY)
 const ta=terminalAngle(props.targetPosition,props.targetX,props.targetY,props.sourceX,props.sourceY)
 const style={stroke:INK,strokeWidth:1.7,strokeDasharray:n.stroke==='dashed'?'7 5':n.stroke==='dotted'?'2 5':undefined,fill:'none'}
 // Ensamblaje: bola conectada a socket en la zona central, no en forma de flecha.
 const assembly=n.end==='assembly'&&(data.diagramType!=='uml-component'||data.componentAssembly)?assemblyAnchor(route.path):null; if(assembly&&data.componentAssembly==='reverse')assembly.angle+=180
 const assemblyLabel=assembly?{x:assembly.x+Math.sin(assembly.angle*Math.PI/180)*30,y:assembly.y-Math.cos(assembly.angle*Math.PI/180)*30}:null
 const composite=data.diagramType==='uml-composite'
 const hasSquares=composite&&['connector','delegation'].includes(data.relationKind||'')
 const squareStart=hasSquares&&['uml-part','uml-port','uml-reference-role'].includes(data.sourceElementType||'')
 const squareEnd=hasSquares&&['uml-part','uml-port','uml-reference-role'].includes(data.targetElementType||'')
 return <>
  {assembly&&<defs><mask id={`atlas-assembly-gap-${props.id}`} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
   <rect x="-100000" y="-100000" width="200000" height="200000" fill="white"/>
   <rect x="-24" y="-15" width="48" height="30" transform={`translate(${assembly.x} ${assembly.y}) rotate(${assembly.angle})`} fill="black"/>
  </mask></defs>}
  <BaseEdge id={props.id} path={actualPath} style={{...style,...(assembly?{mask:`url(#atlas-assembly-gap-${props.id})`}:{})}} interactionWidth={28}/>
  {data.activityInterrupted&&!exception&&<path data-activity-interrupt="true" d={activityInterruptPath(route.labelX,route.labelY)} fill="none" stroke={INK} strokeWidth="2"/>}
  {squareStart&&<rect data-uml-terminal="port-square" x={props.sourceX-5.5} y={props.sourceY-5.5} width="11" height="11" fill="white" stroke={INK} strokeWidth="1.8" pointerEvents="none"/>}
  {nary&&<>{data.diagramType==='uml-component'?<circle cx={hub.x} cy={hub.y} r={4} fill={INK}/>:<polygon points={`${hub.x},${hub.y-10} ${hub.x+14},${hub.y} ${hub.x},${hub.y+10} ${hub.x-14},${hub.y}`} fill="white" stroke={INK}/>}{data.extraEnds?.map(p=><g key={p.id}><path d={`M ${hub.x} ${hub.y} L ${p.x} ${p.y}`} stroke={INK} fill="none"/><Terminal kind={p.navigability==='navigable'?'open-arrow':p.navigability==='non-navigable'?'cross':'none'} x={p.x} y={p.y} angle={terminalAngle(p.side,p.x,p.y,hub.x,hub.y)}/><text x={p.x+8} y={p.y-8} fontSize="10" fill={INK}>{p.label}</text></g>)}</>}
  {data.associationClassPoint&&<path data-uml-association-class="true" d={`M ${hub.x} ${hub.y} L ${data.associationClassPoint.x} ${data.associationClassPoint.y}`} stroke={INK} strokeDasharray="7 5" fill="none"/>}
  {!data.annotationPoint&&<Terminal kind={terminal('source')} x={props.sourceX} y={props.sourceY} angle={sa}/>}
  {squareEnd&&<rect data-uml-terminal="port-square" x={props.targetX-5.5} y={props.targetY-5.5} width="11" height="11" fill="white" stroke={INK} strokeWidth="1.8" pointerEvents="none"/>}
  {!data.annotationPoint&&<Terminal kind={terminal('target')} x={props.targetX} y={props.targetY} angle={ta}/>}
  {assembly&&<g data-uml-terminal="assembly" transform={`translate(${assembly.x},${assembly.y}) rotate(${assembly.angle})`} stroke={INK} strokeWidth="1.8" fill="none" pointerEvents="none" aria-label="Ensamblaje UML: interfaz proporcionada encajada en interfaz requerida">
    {/* La bola se apoya dentro de la cavidad; ambos comparten tangente con la ruta. */}
    <path d="M -23,0 H -12 M 15,0 H 23"/>
    <circle cx="-5" cy="0" r="7" fill="white"/>
    <path d="M 3,-11 Q 25,0 3,11"/>
   </g>}
  {!!data.extensionNote?.length&&<path data-uml-note-anchor="true" d={`M ${hub.x} ${hub.y} L ${hub.x} ${hub.y+15}`} stroke={INK} strokeDasharray="4 3" fill="none" pointerEvents="none"/>}
  {(displayLabel||data.sourceMultiplicity||data.targetMultiplicity||data.sourceRole||data.targetRole||data.extensionNote?.length)&&<EdgeLabelRenderer>
   {data.extensionNote?.length? <div className="uc-extension-note" style={{transform:`translate(-50%,0) translate(${route.labelX}px,${route.labelY+15}px)`}}>{data.extensionNote.map((line,i)=><div key={i}>{line}</div>)}</div>:null}
   {displayLabel&&<div className="atlas-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${assemblyLabel?.x??route.labelX}px,${assemblyLabel?.y??route.labelY}px)`}}>{displayLabel}</div>}
   {(data.sourceMultiplicity||data.sourceRole)&&<div className="atlas-uml-end-label" style={{transform:`translate(-50%,-50%) translate(${sourceLabel.x}px,${sourceLabel.y}px)`}}>{data.sourceRole} {data.sourceMultiplicity}</div>}
   {(data.targetMultiplicity||data.targetRole)&&<div className="atlas-uml-end-label" style={{transform:`translate(-50%,-50%) translate(${targetLabel.x}px,${targetLabel.y}px)`}}>{data.targetRole} {data.targetMultiplicity}</div>}
  </EdgeLabelRenderer>}
 </>
}
export const umlEdgeTypes={'atlas-uml':AtlasUmlEdge}
