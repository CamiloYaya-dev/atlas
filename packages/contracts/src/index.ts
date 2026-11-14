import {validUmlDetail} from './uml-structure'
import type {UmlElementDetail} from './uml-structure'
export * from './permissions'
export {validUmlDetail,umlAttributeText,umlOperationText,umlObjectTitle,UML_VISIBILITY_SYMBOL} from './uml-structure'
export type {UmlVisibility,UmlAttribute,UmlOperation,UmlParameter,UmlSlot,UmlElementDetail} from './uml-structure'
export type ElementType = 'system' | 'actor' | 'container' | 'component' | 'service' | 'endpoint' | 'process' | 'activity' | 'usecase' | 'requirement' | 'database' | 'external' | 'event' | 'document' | 'uml-class' | 'uml-interface' | 'uml-enumeration' | 'uml-object' | 'uml-package' | 'uml-node' | 'uml-artifact' | 'uml-device' | 'uml-execution' | 'uml-port' | 'uml-part' | 'uml-reference-role' | 'uml-collaboration' | 'uml-profile' | 'uml-stereotype' | 'uml-action' | 'uml-decision' | 'uml-start' | 'uml-end' | 'uml-fork' | 'uml-state' | 'uml-transition' | 'uml-lifeline' | 'uml-message' | 'uml-interaction' | 'uml-time' | 'uml-constraint' | 'uml-frame' | 'uml-signal' | 'uml-region'
export type DiagramType = 'c1' | 'c2' | 'c3' | 'c4' | 'process' | 'sequence' | 'data' | 'trace' | 'custom' | 'uml-class' | 'uml-object' | 'uml-component' | 'uml-composite' | 'uml-deployment' | 'uml-package' | 'uml-profile' | 'uml-usecase' | 'uml-activity' | 'uml-state' | 'uml-sequence' | 'uml-communication' | 'uml-interaction-overview' | 'uml-timing'
export type Perspective = 'functional' | 'mixed' | 'technical'
export type Role = string
export type FieldKind = 'text' | 'textarea' | 'url' | 'date' | 'number' | 'select' | 'boolean'
export interface Link { id: string; label: string; url: string }
export interface ModelElement { id: string; name: string; type: ElementType; summary: string; description: string; owner: string; author: string; status: string; createdAt: string; updatedAt: string; group?: string; technical?: string; uml?: UmlElementDetail; childDiagramId?: string; childNodeId?: string; links: Link[]; fields: Record<string, unknown> }
export interface FieldDefinition { id: string; label: string; forType: ElementType | 'all'; kind: FieldKind; options?: string[] }
export interface DiagramNode { id: string; elementId: string; x: number; y: number; width?: number; height?: number; parentNodeId?: string; filterIds?: string[] }
export type EdgeDirection = 'forward' | 'both' | 'none' | 'reverse'
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted'
export type EdgePathStyle = 'smoothstep' | 'straight' | 'step' | 'bezier'
export interface DiagramEdge { id: string; source: string; target: string; label?: string; sourceHandle?: string; targetHandle?: string; direction?: EdgeDirection; lineStyle?: EdgeLineStyle; pathStyle?: EdgePathStyle; relationKind?: string; sourceMultiplicity?: string; targetMultiplicity?: string; sourceRole?: string; targetRole?: string }
export interface DiagramFilter { id: string; label: string }
export interface Diagram { id: string; name: string; description: string; type: DiagramType; nodes: DiagramNode[]; edges: DiagramEdge[]; createdAt: string; filters?: DiagramFilter[] }
export interface ProjectDocument { schema: 1; elements: Record<string, ModelElement>; diagrams: Diagram[]; fieldDefinitions: FieldDefinition[] }
export interface Workspace { id: string; name: string; created_by?: string; role: Role; demo?: boolean }
export interface Project { id: string; workspace_id: string; name: string; description?: string }
export const diagramLabels: Record<DiagramType,string> = { c1:'C1 · Contexto',c2:'C2 · Contenedores',c3:'C3 · Componentes',c4:'C4 · Código',process:'Flujo de procesos',sequence:'Diagrama de secuencia',data:'Flujo de datos',trace:'Matriz de trazabilidad',custom:'Diagrama personalizado','uml-class':'UML · Clases','uml-object':'UML · Objetos','uml-component':'UML · Componentes','uml-composite':'UML · Estructura compuesta','uml-deployment':'UML · Despliegue','uml-package':'UML · Paquetes','uml-profile':'UML · Perfiles','uml-usecase':'UML · Casos de uso','uml-activity':'UML · Actividades','uml-state':'UML · Máquina de estados','uml-sequence':'UML · Secuencia','uml-communication':'UML · Comunicación','uml-interaction-overview':'UML · Interacción general','uml-timing':'UML · Tiempo' }
export const elementLabels: Record<ElementType,string> = { system:'Sistema',actor:'Actor',container:'Contenedor',component:'Componente',service:'Servicio',endpoint:'Endpoint',process:'Proceso',activity:'Actividad',usecase:'Caso de uso',requirement:'Requerimiento',database:'Base de datos',external:'Externo',event:'Evento',document:'Documento','uml-class':'Clase UML','uml-interface':'Interfaz','uml-enumeration':'Enumeración','uml-object':'Objeto (instancia)','uml-package':'Paquete','uml-node':'Nodo de despliegue','uml-artifact':'Artefacto','uml-device':'Dispositivo','uml-execution':'Entorno de ejecución','uml-port':'Puerto','uml-part':'Parte interna','uml-reference-role':'Rol de referencia','uml-collaboration':'Colaboración','uml-profile':'Perfil','uml-stereotype':'Estereotipo','uml-action':'Acción','uml-decision':'Decisión / unión','uml-start':'Nodo inicial','uml-end':'Nodo final','uml-fork':'Bifurcación / unión paralela','uml-state':'Estado','uml-transition':'Transición','uml-lifeline':'Línea de vida','uml-message':'Mensaje','uml-interaction':'Interacción','uml-time':'Observación temporal','uml-constraint':'Restricción','uml-frame':'Marco de interacción','uml-signal':'Señal','uml-region':'Región' }
export const fieldLabels: Record<FieldKind,string> = {text:'Texto',textarea:'Texto largo',url:'URL',date:'Fecha',number:'Número',select:'Lista',boolean:'Sí / No'}
export const validNodeDimension=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=48&&value<=4000
export const uid = () => crypto.randomUUID()
export const today = () => new Date().toISOString().slice(0,10)
export const emptyDoc = (): ProjectDocument => ({schema:1,elements:{},diagrams:[],fieldDefinitions:[{id:'f-priority',label:'Prioridad',forType:'requirement',kind:'select',options:['Baja','Media','Alta','Crítica']},{id:'f-method',label:'Método HTTP',forType:'endpoint',kind:'select',options:['GET','POST','PUT','PATCH','DELETE']},{id:'f-risk',label:'Riesgo funcional',forType:'activity',kind:'select',options:['Bajo','Medio','Alto']}]})
export function isProjectDocument(x: unknown): x is ProjectDocument {
  if (!x || typeof x !== 'object') return false
  const z = x as Record<string,unknown>
  if(z.schema!==1 || !z.elements || typeof z.elements!=='object' || Array.isArray(z.elements) || !Array.isArray(z.diagrams) || !Array.isArray(z.fieldDefinitions))return false
  const elems=z.elements as Record<string,unknown>
  const validElements=Object.values(elems).every(v=>{if(!v||typeof v!=='object')return false;const e=v as Record<string,unknown>;return typeof e.id==='string'&&typeof e.name==='string'&&typeof e.type==='string'&&validUmlDetail(e.uml)&&Array.isArray(e.links)&&!!e.fields&&typeof e.fields==='object'})
  const validDiagrams=z.diagrams.every(v=>{if(!v||typeof v!=='object')return false;const d=v as Record<string,unknown>;return typeof d.id==='string'&&typeof d.name==='string'&&typeof d.type==='string'&&Array.isArray(d.nodes)&&Array.isArray(d.edges)&&((d.filters===undefined)||Array.isArray(d.filters)&&d.filters.length<=100&&d.filters.every((f:unknown)=>!!f&&typeof f==='object'&&typeof (f as Record<string,unknown>).id==='string'&&typeof (f as Record<string,unknown>).label==='string'))&&d.nodes.every((n:unknown)=>{if(!n||typeof n!=='object')return false;const a=n as Record<string,unknown>;return typeof a.id==='string'&&typeof a.elementId==='string'&&typeof a.x==='number'&&typeof a.y==='number'&&(a.width===undefined||validNodeDimension(a.width))&&(a.height===undefined||validNodeDimension(a.height))&&(a.parentNodeId===undefined||typeof a.parentNodeId==='string')&&(a.filterIds===undefined||Array.isArray(a.filterIds)&&a.filterIds.every((v:unknown)=>typeof v==='string'))})&&d.edges.every((n:unknown)=>{if(!n||typeof n!=='object')return false;const a=n as Record<string,unknown>;return typeof a.id==='string'&&typeof a.source==='string'&&typeof a.target==='string'&&(!('sourceHandle'in a)||typeof a.sourceHandle==='string')&&(!('targetHandle'in a)||typeof a.targetHandle==='string')&&(!('direction'in a)||['forward','reverse','both','none'].includes(String(a.direction)))&&(!('lineStyle'in a)||['solid','dashed','dotted'].includes(String(a.lineStyle)))&&(!('pathStyle'in a)||['smoothstep','straight','step','bezier'].includes(String(a.pathStyle)))&&(!('relationKind'in a)||typeof a.relationKind==='string'&&a.relationKind.length<=60)&&['sourceMultiplicity','targetMultiplicity','sourceRole','targetRole'].every(k=>a[k]===undefined||typeof a[k]==='string'&&(a[k] as string).length<=80)})})
  const validFields=z.fieldDefinitions.every(v=>{if(!v||typeof v!=='object')return false;const f=v as Record<string,unknown>;return typeof f.id==='string'&&typeof f.label==='string'&&typeof f.kind==='string'&&typeof f.forType==='string'})
  return validElements&&validDiagrams&&validFields
}
export function createElement(name: string, type: ElementType, author='Usuario'): ModelElement {
  const date = today(); return {id:uid(),name,type,summary:'',description:'',owner:'',author,status:'Borrador',createdAt:date,updatedAt:date,links:[],fields:{}}
}

export {mergeProjectDocuments,MergeConflict,previewProjectMerge} from './collaboration'
export {availableExportFields,validateAdvancedExport,exportFieldsFor,EXPORT_BASE_FIELDS} from './export-fields'
export type {ExportPlacement,AdvancedExportMode,AdvancedExportRequest,ExportFieldChoices,ExportField,DocumentExportFormat} from './export-fields'

export {UML_DIAGRAMS,UML_DIAGRAM_GROUPS,UML_ELEMENTS_BY_DIAGRAM,UML_RELATIONS_BY_DIAGRAM,umlElementAllowed,umlRelationAllowed,umlElementCreatable,umlRelationCreatable,umlRelationEndpointValid,umlRelationLabel,UML_RELATION_LABELS} from './uml'

export {UML_NOTATION,umlRelationNotation,isUmlDiagram,canonicalUmlEdge,validUmlEdgeNotation} from './uml-notation'
export type {UmlRelationNotation,UmlTerminal} from './uml-notation'
export {UML_PACKAGE_SIZE,UML_COMPOSITE_SIZE,UML_PART_SIZE,UML_PORT_SIZE,UML_DEPLOYMENT_CONTAINER_SIZE,UML_EXECUTION_CONTAINER_SIZE,umlContainerAllows,umlContainerSize,umlNodeDepth,umlAncestryValid,umlAbsolutePosition,umlSnapPort} from './uml-containers'

export {atlasNodeSize,atlasNodeMinimum} from './node-sizing'
