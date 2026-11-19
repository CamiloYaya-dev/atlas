import {deploymentEdgePresentation} from './uml-deployment-policy'
import {componentWiringContractName} from './uml-component-policy'
import type {ProjectDocument,Diagram} from './index'
/** Semántica de la notación UML 2.5.1 utilizada por las 14 vistas de NOVZI.
 * La representación gráfica se deriva del tipo, nunca de ajustes libres del trazo.
 * Esto implementa un subconjunto explícito del metamodelo; no declara conformidad total.
 * Referencia: OMG UML 2.5.1, §§ 7.7, 9.7, 10.4, 11.5–11.6, 12, 14–19 y anexo B.
 */
import {classImportAliasAllowed} from './uml-class-catalog'
import {UML_DIAGRAMS,UML_RELATIONS_BY_DIAGRAM} from './uml'
import type {DiagramEdge,DiagramType,EdgeDirection,EdgeLineStyle} from './index'

export type UmlTerminal='none'|'open-arrow'|'filled-arrow'|'triangle'|'diamond-open'|'diamond-filled'|'ball'|'socket'|'assembly'|'cross'|'extension'|'ownership'
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
 'component-realization':spec('dashed','forward','none','triangle'),
 wiring:spec('solid','none','none','assembly'),
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
 usage:spec('dashed','forward','none','open-arrow','«use»'),
 access:spec('dashed','forward','none','open-arrow','«access»'),
 elementAccess:spec('dashed','forward','none','open-arrow','«access»'),
 packageAccess:spec('dashed','forward','none','open-arrow','«access»'),
 packageImport:spec('dashed','forward','none','open-arrow','«import»'),
 elementImport:spec('dashed','forward','none','open-arrow','«import»'),
 'specification-realization':spec('dashed','forward','none','triangle'),
 abstraction:spec('dashed','forward','none','open-arrow','«abstraction»'),
 trace:spec('dashed','forward','none','open-arrow','«trace»'),
 refine:spec('dashed','forward','none','open-arrow','«refine»'),
 derive:spec('dashed','forward','none','open-arrow','«derive»'),
 bind:spec('dashed','forward','none','open-arrow','«bind»'),
 annotation:spec('dashed','none'),
 extension:spec('solid','forward','none','extension'),
 'stereotype-application':spec('dashed','forward','none','open-arrow','«apply»'),
 apply:spec('dashed','forward','none','open-arrow','«apply»'),
 reference:spec('dashed','forward','none','open-arrow','«reference»'),
 include:spec('dashed','forward','none','open-arrow','«include»'),
 extend:spec('dashed','forward','none','open-arrow','«extend»'),
 'exception-handler':spec('solid','forward','none','open-arrow'),
 'control-flow':spec('solid','forward','none','open-arrow'),
 'object-flow':spec('solid','forward','none','open-arrow'),
 fork:spec('solid','forward','none','open-arrow'),
 join:spec('solid','forward','none','open-arrow'),
 exception:spec('solid','forward','none','open-arrow'),
 transition:spec('solid','forward','none','open-arrow'),
 trigger:spec('solid','forward','none','open-arrow'),
 completion:spec('solid','forward','none','open-arrow'),
 'general-ordering':spec('dotted','forward'),
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
 const kind=edge.relationKind || allowed?.[0]
 if(kind&&!allowed?.includes(kind))return edge
 if(!kind)return edge
 const notation=umlRelationNotation(kind)
 const locked=umlRelationNameLocked(diagram,kind)
 const historical=locked&&edge.label&&edge.label!==notation.label?edge.label:undefined
 return {...edge,relationKind:kind,direction:notation.direction,lineStyle:notation.stroke,...(locked?{label:undefined,...(historical?{description:[edge.description,historical].filter(Boolean).join('\n')}: {})}:{})}
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

/** Reserved words are derived even on historical snapshots. */
export function umlEdgeLabel(diagram:DiagramType,edge:DiagramEdge):string{
 return isUmlDiagram(diagram)?umlRelationNotation(edge.relationKind||'').label||(['generalization','realization','specification-realization','component-realization','containment','annotation'].includes(edge.relationKind||'')&&['uml-class','uml-usecase','uml-component','uml-deployment'].includes(diagram)?'':edge.label||''):edge.label||''
}
/** Derived display label, never stored as a business name. */
export function umlDisplayLabel(diagram:DiagramType,edge:DiagramEdge,doc:ProjectDocument,view?:Diagram):string{
 if(diagram==='uml-deployment'&&view)edge=deploymentEdgePresentation(doc,view,edge)
 const record=diagram==='uml-component'&&edge.componentRelationId?doc.componentRelations?.[edge.componentRelationId]:undefined
 const label=umlEdgeLabel(diagram,record?{...edge,label:record.name}:edge)
 if(diagram==='uml-component'&&view){const source=view.nodes.find(n=>n.id===edge.source)?.elementId,target=view.nodes.find(n=>n.id===edge.target)?.elementId;if(target&&['provided-interface','required-interface'].includes(edge.relationKind||''))return doc.elements[target]?.name||'';if(source&&target&&['wiring','assembly'].includes(edge.relationKind||'')){if(record?.wiring?.requiredInterfaceId)return doc.elements[record.wiring.requiredInterfaceId]?.name||'';return componentWiringContractName(doc,source,target)||label}const alias=record?.importAlias||edge.importAlias;if(alias&&['elementImport','elementAccess'].includes(edge.relationKind||''))return `${label} {alias: ${alias}}`}
 if(diagram!=='uml-class')return label
 if(classImportAliasAllowed(edge.relationKind||'')&&edge.importAlias)return `${label} {alias: ${edge.importAlias}}`
 if(edge.relationKind!=='bind'||!edge.templateBindings?.length)return label
 const node=view?.nodes.find(n=>n.id===edge.target),formals=node&&doc.elements[node.elementId]?.uml?.templateParameters
 return `${label} <${edge.templateBindings.map(b=>`${formals?.find(p=>p.id===b.parameterId)?.name||'?'} → ${doc.elements[b.elementId]?.name||'Tipo no disponible'}`).join(', ')}>`
}
export function umlRelationNameLocked(diagram:DiagramType,kind:string):boolean{return diagram==='uml-component'&&['provided-interface','required-interface','wiring'].includes(kind)||isUmlDiagram(diagram)&&!!umlRelationNotation(kind).label&&!(diagram==='uml-sequence'&&kind==='create')||['uml-class','uml-usecase','uml-component','uml-deployment'].includes(diagram)&&['generalization','realization','specification-realization','component-realization','containment','annotation'].includes(kind)}
