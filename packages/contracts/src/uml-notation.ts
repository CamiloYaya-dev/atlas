/** Semántica de la notación UML 2.5.1 utilizada por las 14 vistas de ATLAS.
 * La representación gráfica se deriva del tipo, nunca de ajustes libres del trazo.
 * Esto implementa un subconjunto explícito del metamodelo; no declara conformidad total.
 * Referencia: OMG UML 2.5.1, §§ 7.7, 9.7, 10.4, 11.5–11.6, 12, 14–19 y anexo B.
 */
import {UML_DIAGRAMS,UML_RELATIONS_BY_DIAGRAM} from './uml'
import type {DiagramEdge,DiagramType,EdgeDirection,EdgeLineStyle} from './index'

export type UmlTerminal='none'|'open-arrow'|'filled-arrow'|'triangle'|'diamond-open'|'diamond-filled'|'ball'|'socket'|'assembly'|'cross'|'extension'
export interface UmlRelationNotation {
 stroke:EdgeLineStyle
 direction:EdgeDirection
 start:UmlTerminal
 end:UmlTerminal
 label?:string
}
const spec=(stroke:EdgeLineStyle,direction:EdgeDirection,start:UmlTerminal='none',end:UmlTerminal='none',label?:string):UmlRelationNotation=>({stroke,direction,start,end,label})
/** Las direcciones expresan semántica UML, no opciones de presentación.
 * En una asociación no navegable no hay flechas: la navegabilidad explícita
 * se representa con el tipo de relación correspondiente.
 */
export const UML_NOTATION:Readonly<Record<string,UmlRelationNotation>>={
 association:spec('solid','none'),
 'navigable-association':spec('solid','forward','none','open-arrow'),
 'bidirectional-association':spec('solid','both','open-arrow','open-arrow'),
 link:spec('solid','none'),
 aggregation:spec('solid','none','diamond-open'),
 composition:spec('solid','none','diamond-filled'),
 generalization:spec('solid','forward','none','triangle'),
 realization:spec('dashed','forward','none','triangle'),
 dependency:spec('dashed','forward','none','open-arrow'),
 assembly:spec('solid','none','none','assembly'),
 'provided-interface':spec('solid','none','none','ball'),
 'required-interface':spec('solid','none','none','socket'),
 connector:spec('solid','none'),delegation:spec('solid','none'),
 'communication-path':spec('solid','none'),
 deployment:spec('dashed','forward','none','open-arrow','«deploy»'),
 manifestation:spec('dashed','forward','none','open-arrow','«manifest»'),
 import:spec('dashed','forward','none','open-arrow','«import»'),
 merge:spec('dashed','forward','none','open-arrow','«merge»'),
 containment:spec('solid','none'),
 extension:spec('solid','forward','none','extension'),
 'stereotype-application':spec('dashed','forward','none','open-arrow','«apply»'),
 include:spec('dashed','forward','none','open-arrow','«include»'),
 extend:spec('dashed','forward','none','open-arrow','«extend»'),
 'control-flow':spec('solid','forward','none','open-arrow'),
 'object-flow':spec('solid','forward','none','open-arrow'),
 fork:spec('solid','forward','none','open-arrow'),
 join:spec('solid','forward','none','open-arrow'),
 exception:spec('solid','forward','none','open-arrow'),
 transition:spec('solid','forward','none','open-arrow'),
 trigger:spec('solid','forward','none','open-arrow'),
 completion:spec('solid','forward','none','open-arrow'),
 message:spec('solid','forward','none','filled-arrow'),
 reply:spec('dashed','forward','none','open-arrow'),
 'async-message':spec('solid','forward','none','open-arrow'),
 create:spec('dashed','forward','none','open-arrow','«create»'),
 destroy:spec('solid','forward','none','cross'),
 'interaction-ref':spec('solid','forward','none','open-arrow'),
 decision:spec('solid','forward','none','open-arrow'),
 'timing-transition':spec('solid','forward','none','open-arrow'),
 duration:spec('dashed','none'),
 constraint:spec('dotted','none'),
}
export function isUmlDiagram(type:DiagramType):boolean{return UML_DIAGRAMS.includes(type)}
export function umlRelationNotation(kind:string):UmlRelationNotation{return UML_NOTATION[kind]||spec('solid','none')}
export function canonicalUmlEdge(diagram:DiagramType,edge:DiagramEdge):DiagramEdge{
 if(!isUmlDiagram(diagram))return edge
 const allowed=UML_RELATIONS_BY_DIAGRAM[diagram]
 const kind=edge.relationKind && allowed?.includes(edge.relationKind) ? edge.relationKind : allowed?.[0]
 if(!kind)return edge
 const notation=umlRelationNotation(kind)
 return {...edge,relationKind:kind,direction:notation.direction,lineStyle:notation.stroke}
}
/** Sólo para relaciones nuevas o editadas. Los JSON antiguos se siguen leyendo,
 * y se normalizan visualmente antes de ser editados, sin alterar su historial.
 */
export function validUmlEdgeNotation(diagram:DiagramType,edge:DiagramEdge):boolean{
 if(!isUmlDiagram(diagram))return true
 if(!edge.relationKind||!UML_RELATIONS_BY_DIAGRAM[diagram]?.includes(edge.relationKind))return false
 const notation=umlRelationNotation(edge.relationKind)
 return (edge.direction===undefined||edge.direction===notation.direction) &&
        (edge.lineStyle===undefined||edge.lineStyle===notation.stroke)
}
