export * from './permissions'
export type ElementType = 'system' | 'actor' | 'container' | 'component' | 'service' | 'endpoint' | 'process' | 'activity' | 'usecase' | 'requirement' | 'database' | 'external' | 'event' | 'document'
export type DiagramType = 'c1' | 'c2' | 'c3' | 'c4' | 'process' | 'sequence' | 'data' | 'trace' | 'custom'
export type Perspective = 'functional' | 'mixed' | 'technical'
export type Role = string
export type FieldKind = 'text' | 'textarea' | 'url' | 'date' | 'number' | 'select' | 'boolean'
export interface Link { id: string; label: string; url: string }
export interface ModelElement { id: string; name: string; type: ElementType; summary: string; description: string; owner: string; author: string; status: string; createdAt: string; updatedAt: string; group?: string; technical?: string; childDiagramId?: string; links: Link[]; fields: Record<string, unknown> }
export interface FieldDefinition { id: string; label: string; forType: ElementType | 'all'; kind: FieldKind; options?: string[] }
export interface DiagramNode { id: string; elementId: string; x: number; y: number; filterIds?: string[] }
export interface DiagramEdge { id: string; source: string; target: string; label?: string }
export interface DiagramFilter { id: string; label: string }
export interface Diagram { id: string; name: string; description: string; type: DiagramType; nodes: DiagramNode[]; edges: DiagramEdge[]; createdAt: string; filters?: DiagramFilter[] }
export interface ProjectDocument { schema: 1; elements: Record<string, ModelElement>; diagrams: Diagram[]; fieldDefinitions: FieldDefinition[] }
export interface Workspace { id: string; name: string; created_by?: string; role: Role; demo?: boolean }
export interface Project { id: string; workspace_id: string; name: string; description?: string }
export const diagramLabels: Record<DiagramType,string> = { c1:'C1 · Contexto',c2:'C2 · Contenedores',c3:'C3 · Componentes',c4:'C4 · Código',process:'Flujo de procesos',sequence:'Diagrama de secuencia',data:'Flujo de datos',trace:'Matriz de trazabilidad',custom:'Diagrama personalizado' }
export const elementLabels: Record<ElementType,string> = { system:'Sistema',actor:'Actor',container:'Contenedor',component:'Componente',service:'Servicio',endpoint:'Endpoint',process:'Proceso',activity:'Actividad',usecase:'Caso de uso',requirement:'Requerimiento',database:'Base de datos',external:'Externo',event:'Evento',document:'Documento' }
export const fieldLabels: Record<FieldKind,string> = {text:'Texto',textarea:'Texto largo',url:'URL',date:'Fecha',number:'Número',select:'Lista',boolean:'Sí / No'}
export const uid = () => crypto.randomUUID()
export const today = () => new Date().toISOString().slice(0,10)
export const emptyDoc = (): ProjectDocument => ({schema:1,elements:{},diagrams:[],fieldDefinitions:[{id:'f-priority',label:'Prioridad',forType:'requirement',kind:'select',options:['Baja','Media','Alta','Crítica']},{id:'f-method',label:'Método HTTP',forType:'endpoint',kind:'select',options:['GET','POST','PUT','PATCH','DELETE']},{id:'f-risk',label:'Riesgo funcional',forType:'activity',kind:'select',options:['Bajo','Medio','Alto']}]})
export function isProjectDocument(x: unknown): x is ProjectDocument {
  if (!x || typeof x !== 'object') return false
  const z = x as Record<string,unknown>
  if(z.schema!==1 || !z.elements || typeof z.elements!=='object' || Array.isArray(z.elements) || !Array.isArray(z.diagrams) || !Array.isArray(z.fieldDefinitions))return false
  const elems=z.elements as Record<string,unknown>
  const validElements=Object.values(elems).every(v=>{if(!v||typeof v!=='object')return false;const e=v as Record<string,unknown>;return typeof e.id==='string'&&typeof e.name==='string'&&typeof e.type==='string'&&Array.isArray(e.links)&&!!e.fields&&typeof e.fields==='object'})
  const validDiagrams=z.diagrams.every(v=>{if(!v||typeof v!=='object')return false;const d=v as Record<string,unknown>;return typeof d.id==='string'&&typeof d.name==='string'&&typeof d.type==='string'&&Array.isArray(d.nodes)&&Array.isArray(d.edges)&&((d.filters===undefined)||Array.isArray(d.filters)&&d.filters.length<=100&&d.filters.every((f:unknown)=>!!f&&typeof f==='object'&&typeof (f as Record<string,unknown>).id==='string'&&typeof (f as Record<string,unknown>).label==='string'))&&d.nodes.every((n:unknown)=>{if(!n||typeof n!=='object')return false;const a=n as Record<string,unknown>;return typeof a.id==='string'&&typeof a.elementId==='string'&&typeof a.x==='number'&&typeof a.y==='number'&&(a.filterIds===undefined||Array.isArray(a.filterIds)&&a.filterIds.every((v:unknown)=>typeof v==='string'))})&&d.edges.every((n:unknown)=>{if(!n||typeof n!=='object')return false;const a=n as Record<string,unknown>;return typeof a.id==='string'&&typeof a.source==='string'&&typeof a.target==='string'})})
  const validFields=z.fieldDefinitions.every(v=>{if(!v||typeof v!=='object')return false;const f=v as Record<string,unknown>;return typeof f.id==='string'&&typeof f.label==='string'&&typeof f.kind==='string'&&typeof f.forType==='string'})
  return validElements&&validDiagrams&&validFields
}
export function createElement(name: string, type: ElementType, author='Usuario'): ModelElement {
  const date = today(); return {id:uid(),name,type,summary:'',description:'',owner:'',author,status:'Borrador',createdAt:date,updatedAt:date,links:[],fields:{}}
}

export {mergeProjectDocuments,MergeConflict,previewProjectMerge} from './collaboration'
