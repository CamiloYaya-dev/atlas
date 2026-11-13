import type {Diagram,DiagramType,ElementType,ModelElement,ProjectDocument} from '@atlas/contracts'

/** An academy badge is derived from the saved model, never from a click counter. */
export type AcademyCheck={id:string;title:string;description:string;done:boolean;diagramType?:DiagramType}
export type AcademyAssessment={functional:AcademyCheck[];technical:AcademyCheck[];integration:AcademyCheck[];functionalBadge:boolean;technicalBadge:boolean;integrationBadge:boolean}

function findDiagram(doc:ProjectDocument,type:DiagramType){return doc.diagrams.find(d=>d.type===type)}
function nodes(doc:ProjectDocument,diagram?:Diagram){return (diagram?.nodes||[]).map(n=>({nodeId:n.id,element:doc.elements[n.elementId]})).filter((n):n is {nodeId:string;element:ModelElement}=>!!n.element)}
function contains(doc:ProjectDocument,diagram:Diagram|undefined,type:ElementType,count=1){return nodes(doc,diagram).filter(n=>n.element.type===type).length>=count}
function linked(doc:ProjectDocument,diagram:Diagram|undefined,sourceType:ElementType,targetType:ElementType,anyDirection=true){
 if(!diagram)return false
 const byId=new Map(nodes(doc,diagram).map(n=>[n.nodeId,n.element.type]))
 return diagram.edges.some(edge=>byId.get(edge.source)===sourceType&&byId.get(edge.target)===targetType||anyDirection&&byId.get(edge.source)===targetType&&byId.get(edge.target)===sourceType)
}
function reused(doc:ProjectDocument,a?:Diagram,b?:Diagram,type?:ElementType){
 if(!a||!b)return false
 const ids=new Set(a.nodes.filter(n=>!type||doc.elements[n.elementId]?.type===type).map(n=>n.elementId))
 return b.nodes.some(n=>ids.has(n.elementId))
}
function childLink(doc:ProjectDocument,source?:Diagram,destination?:Diagram,type?:ElementType){
 if(!source||!destination)return false
 return nodes(doc,source).some(n=>(!type||n.element.type===type)&&n.element.childDiagramId===destination.id)
}
function hasTechnicalDetail(doc:ProjectDocument,d?:Diagram){return nodes(doc,d).some(n=>['component','endpoint','service'].includes(n.element.type)&&Boolean(n.element.technical?.trim()))}
/** The inspector must be used to complete a genuine stored element, not just select it. */
function inspectorCompleted(doc:ProjectDocument,diagram:Diagram|undefined,type:ElementType,namePattern:RegExp,technical=false){
 return nodes(doc,diagram).some(({element})=>element.type===type&&namePattern.test(element.name)&&
  Boolean(element.summary?.trim())&&Boolean(element.description?.trim())&&Boolean(element.owner?.trim())&&
  (!technical||Boolean(element.technical?.trim())))
}
function customFieldCompleted(doc:ProjectDocument,diagram:Diagram|undefined,type:ElementType,label:string,kind:'select'|'text',requiredValue?:string){
 const def=doc.fieldDefinitions.find(f=>f.label.toLocaleLowerCase('es').trim()===label.toLocaleLowerCase('es')&&f.forType===type&&f.kind===kind)
 if(!def)return false
 if(kind==='select'&&(!def.options||!['Web','Móvil','API'].every(option=>def.options?.includes(option))))return false
 return nodes(doc,diagram).some(({element})=>element.type===type&&
  (type!=='requirement'||/^HU[-\s]/i.test(element.name))&&
  (type!=='endpoint'||/POST/i.test(element.name))&&
  (kind==='select'?typeof element.fields[def.id]==='string'&&def.options?.includes(String(element.fields[def.id])):
    typeof element.fields[def.id]==='string'&&String(element.fields[def.id]).trim().toUpperCase()===requiredValue))
}

function linkedStoryAndRule(doc:ProjectDocument,diagram?:Diagram){
 if(!diagram)return false
 const byNode=new Map(nodes(doc,diagram).map(n=>[n.nodeId,n.element]))
 const linkedRequirements=new Set(diagram.edges.filter(edge=>(byNode.get(edge.source)?.type==='requirement'&&byNode.get(edge.target)?.type==='usecase')||(byNode.get(edge.target)?.type==='requirement'&&byNode.get(edge.source)?.type==='usecase')).map(edge=>(byNode.get(edge.source)?.type==='requirement'?byNode.get(edge.source):byNode.get(edge.target))?.id))
 const requirements=[...linkedRequirements].map(id=>id?doc.elements[id]:null).filter((item):item is ModelElement=>!!item)
 return requirements.some(item=>/^HU[-\s]/i.test(item.name))&&requirements.some(item=>/^RF[-\s]/i.test(item.name))
}

/**
 * Training exercises in a deliberately separate workspace/project. A course is not
 * passed by reading instructions or merely creating empty diagrams: it must have
 * valid connections, linked views and reused element identities.
 * `saved` is the editor's current acknowledged status. The backend is the authority.
 */
export function assessAcademy(doc:ProjectDocument|null,saved:boolean,mode:'functional'|'technical'|'mixed',activeDiagramId:string):AcademyAssessment{
 const d=doc??{schema:1 as const,elements:{},diagrams:[],fieldDefinitions:[]}
 const c1=findDiagram(d,'c1'),process=findDiagram(d,'process'),trace=findDiagram(d,'trace'),c2=findDiagram(d,'c2'),c3=findDiagram(d,'c3'),c4=findDiagram(d,'c4')
 const functional:AcademyCheck[]=[
  {id:'c1',title:'Construye el contexto funcional',description:'C1 con Actor, Sistema y Proceso; conecta al menos dos cajas con líneas.',done:!!c1&&contains(d,c1,'actor')&&contains(d,c1,'system')&&contains(d,c1,'process')&&c1.edges.length>=2&&linked(d,c1,'actor','system')&&linked(d,c1,'system','process'),diagramType:'c1'},
  {id:'process',title:'Dibuja el flujo de solicitudes',description:'Diagrama de procesos con dos actividades vinculadas (registrar y revisar una solicitud).',done:!!process&&contains(d,process,'activity',2)&&linked(d,process,'activity','activity'),diagramType:'process'},
  {id:'trace',title:'Documenta una HU, un RF y su caso de uso',description:'Matriz con dos Requerimientos (HU-01 y RF-01) y un Caso de uso; conecta los requisitos con el caso de uso.',done:!!trace&&nodes(d,trace).some(n=>n.element.type==='requirement'&&/^HU[-\s]/i.test(n.element.name))&&nodes(d,trace).some(n=>n.element.type==='requirement'&&/^RF[-\s]/i.test(n.element.name))&&contains(d,trace,'usecase')&&linkedStoryAndRule(d,trace),diagramType:'trace'},
  {id:'functional-inspector',title:'Completa la ficha de la historia de usuario',description:'Selecciona la HU-01 en la matriz y utiliza el Inspector para añadir Resumen, Descripción y Responsable.',done:inspectorCompleted(d,trace,'requirement',/^HU[-\s]/i),diagramType:'trace'},
  {id:'functional-field',title:'Crea y utiliza un campo personalizado funcional',description:'Crea «Canal de solicitud» como Lista para Requerimiento, con opciones Web, Móvil y API. Luego selecciona un valor en la HU-01 desde el Inspector.',done:customFieldCompleted(d,trace,'requirement','Canal de solicitud','select'),diagramType:'trace'},
  {id:'functional-link',title:'Conecta el contexto con el proceso',description:'En C1, selecciona la caja Proceso y asigna la vista de procesos en «Vista vinculada (doble clic)».',done:childLink(d,c1,process,'process'),diagramType:'c1'},
  {id:'functional-reuse',title:'Reutiliza un requisito en el flujo',description:'En el diagrama de procesos, usa «Agregar caja → Reutilizar existente» para colocar la misma HU de trazabilidad.',done:reused(d,trace,process,'requirement'),diagramType:'process'}
 ]
 const technical:AcademyCheck[]=[
  {id:'c2',title:'Modela los contenedores',description:'C2 con una aplicación Contenedor, un Servicio API y una Base de datos; crea al menos dos relaciones.',done:!!c2&&contains(d,c2,'container')&&contains(d,c2,'service')&&contains(d,c2,'database')&&c2.edges.length>=2&&linked(d,c2,'container','service',true)&&linked(d,c2,'service','database',true),diagramType:'c2'},
  {id:'c3',title:'Desglosa la API en componentes',description:'C3 con Componente y Endpoint, una relación entre ellos y un «Detalle técnico» en su ficha.',done:!!c3&&contains(d,c3,'component')&&contains(d,c3,'endpoint')&&linked(d,c3,'component','endpoint')&&hasTechnicalDetail(d,c3),diagramType:'c3'},
  {id:'c4',title:'Representa la implementación en C4',description:'Diagrama de código con dos Componentes conectados y un detalle técnico que explique su responsabilidad.',done:!!c4&&contains(d,c4,'component',2)&&linked(d,c4,'component','component')&&hasTechnicalDetail(d,c4),diagramType:'c4'},
  {id:'technical-inspector',title:'Documenta un endpoint desde el Inspector',description:'En C3 selecciona POST /solicitudes y completa Resumen, Descripción, Responsable y Detalle técnico.',done:inspectorCompleted(d,c3,'endpoint',/POST/i,true),diagramType:'c3'},
  {id:'technical-field',title:'Define y utiliza un campo técnico personalizado',description:'Crea «Protocolo de integración» como Texto para Endpoint y escribe HTTPS en el campo desde su Inspector.',done:customFieldCompleted(d,c3,'endpoint','Protocolo de integración','text','HTTPS'),diagramType:'c3'},
  {id:'technical-link',title:'Vincula C1 → C2 → C3 → C4',description:'Sistema en C1 → C2; Servicio API en C2 → C3; Componente en C3 → C4 (doble clic).',done:childLink(d,c1,c2,'system')&&childLink(d,c2,c3,'service')&&childLink(d,c3,c4,'component'),diagramType:'c3'},
  {id:'technical-trace',title:'Relaciona el requisito con su implementación',description:'Reutiliza en trazabilidad el Componente de C3 y conéctalo con la HU o RF existente.',done:reused(d,c3,trace,'component')&&linked(d,trace,'requirement','component'),diagramType:'trace'}
 ]
 const functionalBadge=saved&&functional.every(item=>item.done)
 const technicalBadge=functionalBadge&&technical.every(item=>item.done)
 const integration:AcademyCheck[]=[
  {id:'integrated-model',title:'Conserva el modelo funcional y técnico conectado',description:'Las dos rutas anteriores deben estar completas y sus elementos compartidos.',done:technicalBadge,diagramType:'trace'},
  {id:'mixed-view',title:'Explora la misma matriz en perspectiva mixta',description:'Abre la matriz de trazabilidad y cambia la perspectiva a «Mixta». No necesitas duplicar diagramas.',done:technicalBadge&&mode==='mixed'&&activeDiagramId===trace?.id,diagramType:'trace'}
 ]
 return {functional,technical,integration,functionalBadge,technicalBadge,integrationBadge:technicalBadge&&saved&&integration.every(item=>item.done)}
}

export type AcademyLabIdentity={workspaceId:string;projectId?:string}
export const academyStorageKey=(accountId:string)=>`atlas.academy.lab.v1.${accountId}`
export function readAcademyLab(accountId:string):AcademyLabIdentity|null{
 try{const saved=JSON.parse(window.localStorage.getItem(academyStorageKey(accountId))||'null') as unknown
  if(saved&&typeof saved==='object'&&typeof (saved as AcademyLabIdentity).workspaceId==='string'){
   const identity=saved as AcademyLabIdentity
   return {workspaceId:identity.workspaceId,...(typeof identity.projectId==='string'?{projectId:identity.projectId}:{})}
  }
 }catch{/* browser storage disabled */}
 return null
}
export function storeAcademyLab(accountId:string,identity:AcademyLabIdentity){try{window.localStorage.setItem(academyStorageKey(accountId),JSON.stringify(identity))}catch{/* progress remains functional in memory */}}
