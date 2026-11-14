/** UML 2.5.1: símbolos geométricos explícitos en los extremos del conector.
 * No usamos markerStart/markerEnd de React Flow para UML: un rombo o socket
 * no es una flecha genérica y su orientación depende del PUERTO conectado.
 */
import {BaseEdge,EdgeLabelRenderer} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import type {EdgePathStyle,UmlTerminal,DiagramType,ElementType} from '@atlas/contracts'
import {umlRelationNotation} from '@atlas/contracts'
import {parallelRoute} from '../../features/editor/domain/parallel-edges'
import {assemblyAnchor} from './uml-assembly'
export type UmlEdgeData={parallelOffset:number;parallelPath:EdgePathStyle;relationKind?:string;diagramType?:DiagramType;sourceElementType?:ElementType;targetElementType?:ElementType;sourceMultiplicity?:string;targetMultiplicity?:string;sourceRole?:string;targetRole?:string}
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
  {kind==='cross'&&<path d="M -8,-8 L 8,8 M -8,8 L 8,-8" strokeWidth={2.6}/>}
 </g>
}
export function AtlasUmlEdge(props:EdgeProps){
 const data=(props.data||{}) as Partial<UmlEdgeData>
 const n=umlRelationNotation(data.relationKind||'association')
 const route=parallelRoute({sourceX:props.sourceX,sourceY:props.sourceY,targetX:props.targetX,targetY:props.targetY,sourcePosition:props.sourcePosition,targetPosition:props.targetPosition,offset:data.parallelOffset||0,pathStyle:data.parallelPath||'straight'})
 const sa=terminalAngle(props.sourcePosition,props.sourceX,props.sourceY,props.targetX,props.targetY)
 const ta=terminalAngle(props.targetPosition,props.targetX,props.targetY,props.sourceX,props.sourceY)
 const style={stroke:INK,strokeWidth:1.7,strokeDasharray:n.stroke==='dashed'?'7 5':n.stroke==='dotted'?'2 5':undefined,fill:'none'}
 // Ensamblaje: bola conectada a socket en la zona central, no en forma de flecha.
 const assembly=n.end==='assembly'?assemblyAnchor(route.path):null
 const assemblyLabel=assembly?{x:assembly.x+Math.sin(assembly.angle*Math.PI/180)*30,y:assembly.y-Math.cos(assembly.angle*Math.PI/180)*30}:null
 const composite=data.diagramType==='uml-composite'
 const hasSquares=composite&&['connector','delegation'].includes(data.relationKind||'')
 const squareStart=hasSquares&&['uml-part','uml-port','uml-reference-role'].includes(data.sourceElementType||'')
 const squareEnd=hasSquares&&['uml-part','uml-port','uml-reference-role'].includes(data.targetElementType||'')
 return <>
  {assembly&&<defs><mask id={`atlas-assembly-gap-${props.id}`} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
   <rect x="-100000" y="-100000" width="200000" height="200000" fill="white"/>
   <rect x="-16" y="-15" width="32" height="30" transform={`translate(${assembly.x} ${assembly.y}) rotate(${assembly.angle})`} fill="black"/>
  </mask></defs>}
  <BaseEdge id={props.id} path={route.path} style={{...style,...(assembly?{mask:`url(#atlas-assembly-gap-${props.id})`}:{})}} interactionWidth={28}/>
  {squareStart&&<rect data-uml-terminal="port-square" x={props.sourceX-5.5} y={props.sourceY-5.5} width="11" height="11" fill="white" stroke={INK} strokeWidth="1.8" pointerEvents="none"/>}
  <Terminal kind={n.start} x={props.sourceX} y={props.sourceY} angle={sa}/>
  {squareEnd&&<rect data-uml-terminal="port-square" x={props.targetX-5.5} y={props.targetY-5.5} width="11" height="11" fill="white" stroke={INK} strokeWidth="1.8" pointerEvents="none"/>}
  <Terminal kind={n.end} x={props.targetX} y={props.targetY} angle={ta}/>
  {assembly&&<g data-uml-terminal="assembly" transform={`translate(${assembly.x},${assembly.y}) rotate(${assembly.angle})`} stroke={INK} strokeWidth="1.8" fill="none" pointerEvents="none" aria-label="Ensamblaje UML: interfaz proporcionada encajada en interfaz requerida">
    {/* La bola se apoya dentro de la cavidad; ambos comparten tangente con la ruta. */}
    <path d="M -16,0 H -10 M 15,0 H 24"/>
    <circle cx="-2" cy="0" r="8" fill="white"/>
    <path d="M 14,-12 Q -2,0 14,12"/>
   </g>}
  {(props.label||data.sourceMultiplicity||data.targetMultiplicity||data.sourceRole||data.targetRole)&&<EdgeLabelRenderer>
   {props.label&&<div className="atlas-parallel-edge-label" style={{transform:`translate(-50%,-50%) translate(${assemblyLabel?.x??route.labelX}px,${assemblyLabel?.y??route.labelY}px)`}}>{props.label}</div>}
   {(data.sourceMultiplicity||data.sourceRole)&&<div className="atlas-uml-end-label" style={{transform:`translate(-50%,-50%) translate(${props.sourceX+20}px,${props.sourceY-15}px)`}}>{data.sourceRole} {data.sourceMultiplicity}</div>}
   {(data.targetMultiplicity||data.targetRole)&&<div className="atlas-uml-end-label" style={{transform:`translate(-50%,-50%) translate(${props.targetX-20}px,${props.targetY-15}px)`}}>{data.targetRole} {data.targetMultiplicity}</div>}
  </EdgeLabelRenderer>}
 </>
}
export const umlEdgeTypes={'atlas-uml':AtlasUmlEdge}
