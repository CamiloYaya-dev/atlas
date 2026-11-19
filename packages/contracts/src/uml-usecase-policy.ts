/** UC-01–10. Shared semantic policy; layout and identity are deliberately separate. */
import type {Diagram,DiagramEdge,ElementType,ModelElement,ProjectDocument} from './index'
import {validMultiplicity,classDetailErrors} from './uml-class-policy'
import {validUmlEdgeNotation,umlRelationNameLocked} from './uml-notation'
export interface UseCaseDetail {presentation?:'symbol'|'rectangle';abstract?:boolean;leaf?:boolean;extensionPoints?:{id:string;name:string;description?:string;location?:string}[];subjectIds?:string[];classifierId?:string;objective?:string;preconditions?:string;postconditions?:string;mainFlow?:string;alternateFlows?:string;exceptions?:string;stereotype?:string}
import {USECASE_RELATIONS,USECASE_CREATION_TYPES,useCaseEndpointValid,useCaseContext} from './uml-usecase-catalog'
export * from './uml-usecase-catalog'
/** A visual occurrence is not the catalog identity. Only native UC elements can acquire this provenance. */
export const isUseCaseCatalogType=(t:ElementType)=>USECASE_CREATION_TYPES.includes(t)
/** Repair only the redundant endpoint of a persisted legacy annotation, on a copy.
 * Do not use this on untrusted new writes: strict validation must reject those. */
export function repairStoredUseCaseAnnotations(doc:ProjectDocument):ProjectDocument{
 let changed=false
 const diagrams=doc.diagrams.map(d=>{
  if(d.type!=='uml-usecase')return d
  let local=false
  const edges=d.edges.map(e=>{
   if(e.relationKind!=='annotation'||!e.annotationTargetEdgeId)return e
   const anchor=d.edges.find(x=>x.id===e.annotationTargetEdgeId&&x.id!==e.id&&x.relationKind!=='annotation')
   if(!anchor||e.target===anchor.source||!d.nodes.some(n=>n.id===anchor.source))return e
   local=changed=true
   const {targetHandle:_,...rest}=e
   return {...rest,target:anchor.source}
  })
  return local?{...d,edges}:d
 })
 return changed?{...doc,diagrams}:doc
}
/** Preserve an isolated native element only if its provenance is established by UML use-case occurrences.
 * Full document is required: a placement in another diagram must not grant access through the catalog. */
export function retainUseCaseCatalog(before:ProjectDocument,after:ProjectDocument):ProjectDocument{
 const former=new Set(before.diagrams.filter(d=>d.type==='uml-usecase').flatMap(d=>d.nodes.map(n=>n.elementId)))
 const placed=new Set(after.diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
 const inUseCase=new Set(after.diagrams.filter(d=>d.type==='uml-usecase').flatMap(d=>d.nodes.map(n=>n.elementId)))
 let changed=false;const elements={...after.elements}
 for(const [id,e] of Object.entries(elements)){
  const marker=isUseCaseCatalogType(e.type)&&(!placed.has(id)?former.has(id)||e.useCaseCatalog===true:inUseCase.has(id)&&e.useCaseCatalog===true)
  if(marker===Boolean(e.useCaseCatalog))continue
  changed=true;const {useCaseCatalog:_,...rest}=e;elements[id]=marker?{...rest,useCaseCatalog:true}:rest
 }
 return changed?{...after,elements}:after
}
/** Explicit model deletion is only allowed once all visual and semantic references are gone. */
export function useCaseElementIsReferenced(doc:ProjectDocument,id:string):boolean{
 return doc.diagrams.some(d=>d.nodes.some(n=>n.elementId===id))||Object.values(useCaseRegistry(doc)).some(r=>r.sourceElementId===id||r.targetElementId===id)||Object.values(doc.elements).some(e=>e.id!==id&&(e.semanticOwnerId===id||e.useCaseDetail?.classifierId===id||e.useCaseDetail?.subjectIds?.includes(id)||e.uml?.attributes?.some(a=>a.typeId===id)||e.uml?.operations?.some(o=>o.returnTypeId===id||o.parameters.some(p=>p.typeId===id))||e.uml?.templateParameters?.some(p=>p.typeId===id)))||doc.diagrams.some(d=>d.edges.some(e=>e.associationClassId===id||e.templateBindings?.some(b=>b.elementId===id)))
}
const primary=(t:ElementType)=>t==='actor'||t==='usecase'
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const text=(v:unknown,max=10000):v is string=>typeof v==='string'&&v.length<=max
const id=(v:unknown):v is string=>text(v,160)&&!!v.trim()
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=100&&v.every(id)&&new Set(v).size===v.length
export function validUseCaseDetail(v:unknown):v is UseCaseDetail|undefined{
 if(v===undefined)return true
 if(!obj(v))return false
 for(const [k,x] of Object.entries(v)){if(x===undefined)continue
  if(['objective','preconditions','postconditions','mainFlow','alternateFlows','exceptions','stereotype'].includes(k)){if(!text(x))return false}
  else if(k==='abstract'||k==='leaf'){if(typeof x!=='boolean')return false}
  else if(k==='presentation'){if(x!=='symbol'&&x!=='rectangle')return false}
  else if(k==='classifierId'){if(!id(x))return false}
  else if(k==='subjectIds'){if(!ids(x))return false}
  else if(k==='extensionPoints'){if(!Array.isArray(x)||x.length>100||!x.every(p=>obj(p)&&id(p.id)&&id(p.name)&&Object.keys(p).every(k=>['id','name','description','location'].includes(k))&&['description','location'].every(k=>p[k]===undefined||text(p[k]))))return false}
  else return false
 }return true
}
export function validUseCaseEdgeShape(e:Record<string,unknown>):boolean{return (e.semanticRelationId===undefined||id(e.semanticRelationId))&&(e.extensionPointIds===undefined||ids(e.extensionPointIds))&&(e.extensionCondition===undefined||text(e.extensionCondition))&&(e.showExtensionNote===undefined||typeof e.showExtensionNote==='boolean')&&(e.dependencyContext===undefined||text(e.dependencyContext))}
export const canonicalSubjectId=(doc:ProjectDocument,id:string)=>doc.elements[id]?.type==='uml-subject'?doc.elements[id].useCaseDetail?.classifierId||id:id
export const useCaseSubjects=(doc:ProjectDocument,e:ModelElement)=>new Set((e.useCaseDetail?.subjectIds||[]).map(id=>canonicalSubjectId(doc,id)))
export function useCaseRelationKinds(doc:ProjectDocument,a:ModelElement,b:ModelElement):string[]{return a.id===b.id?[]:USECASE_RELATIONS.filter(k=>useCaseEndpointValid(k,a.type,b.type)&&!(k==='generalization'&&((b.useCaseDetail?.leaf??b.uml?.leaf)))&&!(k==='association'&&a.type==='usecase'&&b.type==='usecase'&&!disjoint(doc,a,b)))}
function disjoint(doc:ProjectDocument,a:ModelElement,b:ModelElement){const x=useCaseSubjects(doc,a),y=useCaseSubjects(doc,b);return !!x.size&&!!y.size&&![...x].some(t=>y.has(t))}
export function useCaseExtensionNote(doc:ProjectDocument,d:Diagram,e:DiagramEdge):string[]{if(e.relationKind!=='extend'||e.showExtensionNote===false)return [];const target=doc.elements[d.nodes.find(n=>n.id===e.target)?.elementId||''];return [...(e.extensionCondition?[`condition: {${e.extensionCondition}}`]:[]),`extension points: ${(e.extensionPointIds||[]).map(id=>target?.useCaseDetail?.extensionPoints?.find(p=>p.id===id)?.name||'Punto no disponible').join(', ')||'Sin puntos (incompleto)'}`]}
export interface UseCaseIssue {key:string;message:string}
const endKeys=['sourceMultiplicity','targetMultiplicity','sourceRole','targetRole','sourceNavigability','targetNavigability'] as const
const baseKeys=['id','source','target','sourceHandle','targetHandle','label','direction','lineStyle','pathStyle','relationKind','description','semanticRelationId']
const semanticKeys=['relationKind','label','description',...endKeys,'extensionPointIds','extensionCondition','dependencyContext'] as const
const signature=(d:Diagram,e:DiagramEdge)=>JSON.stringify([d.nodes.find(n=>n.id===e.source)?.elementId,d.nodes.find(n=>n.id===e.target)?.elementId,...semanticKeys.map(k=>e[k]??null)])
/** Semantic values survive removal of every occurrence. Geometry belongs to DiagramEdge. */
export type UseCaseRelation=Pick<DiagramEdge,typeof semanticKeys[number]> & {id:string;sourceElementId:string;targetElementId:string}
export function validUseCaseRegistry(value:unknown):boolean{
 if(value===undefined)return true
 return obj(value)&&Object.entries(value).every(([key,r])=>obj(r)&&key===r.id&&id(r.id)&&id(r.sourceElementId)&&id(r.targetElementId)&&typeof r.relationKind==='string'&&r.relationKind!=='annotation'&&USECASE_RELATIONS.some(k=>k===r.relationKind)&&Object.keys(r).every(k=>['id','sourceElementId','targetElementId',...semanticKeys].includes(k))&&validUseCaseEdgeShape(r)&&['label','description'].every(k=>r[k]===undefined||text(r[k]))&&endKeys.filter(k=>!k.endsWith('Navigability')).every(k=>r[k]===undefined||text(r[k],80))&&['sourceNavigability','targetNavigability'].every(k=>r[k]===undefined||['navigable','non-navigable','unspecified'].includes(String(r[k]))))
}
export function useCaseRelationRecord(d:Diagram,e:DiagramEdge):UseCaseRelation|undefined{
 const sourceElementId=d.nodes.find(n=>n.id===e.source)?.elementId,targetElementId=d.nodes.find(n=>n.id===e.target)?.elementId
 if(!sourceElementId||!targetElementId||!e.semanticRelationId||e.relationKind==='annotation'||!e.relationKind)return undefined
 return {id:e.semanticRelationId,sourceElementId,targetElementId,...Object.fromEntries(semanticKeys.filter(k=>e[k]!==undefined).map(k=>[k,structuredClone(e[k])]))}
}
const recordSignature=(r:UseCaseRelation)=>JSON.stringify([r.sourceElementId,r.targetElementId,...semanticKeys.map(k=>r[k]??null)])
/** Deterministic legacy adapter. Never updates the input or merges distinct legacy edge IDs. */
export function adaptUseCaseDocument(doc:ProjectDocument):ProjectDocument{
 if(doc.useCaseRelations!==undefined)return doc
 const registry=new Map<string,UseCaseRelation>(),reserved=new Set(doc.diagrams.filter(d=>d.type==='uml-usecase').flatMap(d=>d.edges.flatMap(e=>e.semanticRelationId?[e.semanticRelationId]:[])));let changed=false
 const diagrams=doc.diagrams.map(d=>d.type!=='uml-usecase'?d:{...d,edges:d.edges.map(e=>{
  if(!e.relationKind||e.relationKind==='annotation')return e
  let legacy=`legacy:${encodeURIComponent(d.id)}:${encodeURIComponent(e.id)}`;while(reserved.has(legacy))legacy+='~';if(!e.semanticRelationId)reserved.add(legacy);const next=e.semanticRelationId?e:{...e,semanticRelationId:legacy}
  const r=useCaseRelationRecord(d,next);if(r&&!registry.has(r.id))registry.set(r.id,r);changed=true;return next
 })})
 return changed?{...doc,diagrams,useCaseRelations:Object.fromEntries(registry)}:doc
}
export const useCaseRegistry=(doc:ProjectDocument)=>adaptUseCaseDocument(doc).useCaseRelations||{}
export function removeUseCaseSemanticRelation(doc:ProjectDocument,id:string):ProjectDocument{
 doc=adaptUseCaseDocument(doc);if(!Object.hasOwn(doc.useCaseRelations||{},id))throw Error('Relación semántica inexistente')
 const useCaseRelations={...doc.useCaseRelations};delete useCaseRelations[id]
 const diagrams=doc.diagrams.map(d=>{if(d.type!=='uml-usecase')return d;const removed=new Set(d.edges.filter(e=>e.semanticRelationId===id).map(e=>e.id));return {...d,edges:d.edges.filter(e=>!removed.has(e.id)&&!(e.annotationTargetEdgeId&&removed.has(e.annotationTargetEdgeId)))}})
 return {...doc,useCaseRelations,diagrams}
}
/** Replace or explicitly delete referencing extensions, including dormant relations. */
export function resolveUseCasePoint(doc:ProjectDocument,elementId:string,pointId:string,replacementId?:string):ProjectDocument{
 doc=adaptUseCaseDocument(doc);const target=doc.elements[elementId],points=target?.useCaseDetail?.extensionPoints||[]
 if(!points.some(p=>p.id===pointId)||replacementId===pointId||replacementId&&!points.some(p=>p.id===replacementId))throw Error('Punto de sustitución inválido')
 for(const record of Object.values(useCaseRegistry(doc))){if(record.relationKind!=='extend'||record.targetElementId!==elementId||!record.extensionPointIds?.includes(pointId))continue
  if(!replacementId){doc=removeUseCaseSemanticRelation(doc,record.id);continue}
  const nextIds=[...new Set(record.extensionPointIds.map(id=>id===pointId?replacementId:id))]
  doc={...doc,useCaseRelations:{...doc.useCaseRelations,[record.id]:{...record,extensionPointIds:nextIds}},diagrams:doc.diagrams.map(d=>d.type==='uml-usecase'?{...d,edges:d.edges.map(e=>e.semanticRelationId===record.id?{...e,extensionPointIds:nextIds}:e)}:d)}
 }
 return {...doc,elements:{...doc.elements,[elementId]:{...target,useCaseDetail:{...target.useCaseDetail,extensionPoints:points.filter(p=>p.id!==pointId)}}}}
}
function reaches(graph:Map<string,Set<string>>,from:string,to:string){const seen=new Set<string>(),stack=[from];while(stack.length){const x=stack.pop()!;if(x===to)return true;if(seen.has(x))continue;seen.add(x);stack.push(...graph.get(x)||[])}return false}
export function useCaseDocumentIssues(doc:ProjectDocument):UseCaseIssue[]{
 const registry=doc.useCaseRelations;const out:UseCaseIssue[]=[],add=(key:string,message:string)=>out.push({key,message}),views=doc.diagrams.filter(d=>d.type==='uml-usecase'),used=new Set(views.flatMap(d=>d.nodes.map(n=>n.elementId))),shared=new Map<string,string>(),arcs=new Map<string,Map<string,Set<string>>>(),relations:{key:string;kind:string;a:string;b:string}[]=[]
 const represented=new Set(views.flatMap(d=>d.edges.map(e=>e.semanticRelationId)))
 if(registry){if(!validUseCaseRegistry(registry))add('registry','Registro semántico inválido');else for(const r of Object.values(registry)){if(represented.has(r.id))continue;const {id:semanticRelationId,sourceElementId,targetElementId,...values}=r;const edge:DiagramEdge={...values,id:'semantic',semanticRelationId,source:'source',target:'target'};views.push({id:'@semantic/'+r.id,type:'uml-usecase',name:'',description:'',createdAt:'',nodes:[{id:'source',elementId:sourceElementId,x:0,y:0},{id:'target',elementId:targetElementId,x:0,y:0}],edges:[edge]});used.add(sourceElementId);used.add(targetElementId)}}
 for(const e of Object.values(doc.elements)){
  if(e.useCaseCatalog!==undefined&&(e.useCaseCatalog!==true||!isUseCaseCatalogType(e.type)))add(`element:${e.id}`,'Procedencia de catálogo inválida')
  if(!used.has(e.id)&&!e.useCaseDetail&&!e.useCaseCatalog)continue
  const key=`element:${e.id}`,u=e.useCaseDetail||{}
  if(!validUseCaseDetail(e.useCaseDetail)){add(key,'Detalle funcional UML inválido');continue}
  if(!e.name.trim())add(key,'Nombre requerido')
  const allowed=e.type==='usecase'?['presentation','abstract','leaf','extensionPoints','subjectIds','objective','preconditions','postconditions','mainFlow','alternateFlows','exceptions','stereotype']:e.type==='actor'?['presentation','abstract','leaf','stereotype']:e.type==='uml-subject'?['classifierId','stereotype']:[]
  for(const k of Object.keys(u))if(!allowed.includes(k)&&u[k as keyof UseCaseDetail]!==undefined)add(key,'Propiedad no permitida: '+k)
  if((u.abstract??e.uml?.abstract)&&(u.leaf??e.uml?.leaf))add(key,'Abstract y final incompatibles')
  if(primary(e.type)){const member=e.uml||{};for(const k of Object.keys(member))if(!['attributes','operations','abstract','leaf','visibility'].includes(k)&&member[k as keyof typeof member]!==undefined)add(key,'Propiedad UML incompatible: '+k);for(const message of classDetailErrors({...e,type:'uml-class',uml:{attributes:member.attributes,operations:member.operations}},doc))add(key,message)}
  if(e.type==='uml-subject'&&e.uml&&Object.values(e.uml).some(x=>x!==undefined))add(key,'El límite no admite miembros UML')
  if(u.classifierId&&(!doc.elements[u.classifierId]||!useCaseContext(doc.elements[u.classifierId].type)))add(key,'Clasificador del sujeto inválido')
  const points=u.extensionPoints||[];if(new Set(points.map(p=>p.id)).size!==points.length||new Set(points.map(p=>p.name.trim())).size!==points.length)add(key,'Punto de extensión duplicado')
  for(const subject of u.subjectIds||[])if(!doc.elements[subject]||!(doc.elements[subject].type==='uml-subject'||useCaseContext(doc.elements[subject].type)))add(key,'Sujeto inexistente o incompatible')
  if(useCaseSubjects(doc,e).size!==(u.subjectIds||[]).length)add(key,'Sujeto semántico duplicado')
 }
 for(const d of views){
  const element=(node:string)=>doc.elements[d.nodes.find(n=>n.id===node)?.elementId||'']
  for(const n of d.nodes)if(n.parentNodeId){const e=element(n.id),p=element(n.parentNodeId);if(!e||!p||e.type!=='usecase'||p.type!=='uml-subject'||!useCaseSubjects(doc,e).has(canonicalSubjectId(doc,p.id)))add(`node:${d.id}:${n.id}`,'Contención sin aplicabilidad al sujeto')}
  for(const e of d.edges){const key=`edge:${d.id}:${e.id}`,a=element(e.source),b=element(e.target),k=e.relationKind||''
   if(!a||!b||!useCaseEndpointValid(k,a.type,b.type)||a.id===b.id){add(key,'Extremos incompatibles o autorrelación UML');continue}
   if(!validUseCaseEdgeShape(e as unknown as Record<string,unknown>)||[e.sourceNavigability,e.targetNavigability].some(v=>v!==undefined&&!['navigable','non-navigable','unspecified'].includes(v)))add(key,'Detalle de relación inválido')
   const allowed=[...baseKeys,...(k==='association'?endKeys:[]),...(k==='extend'?['extensionPointIds','extensionCondition','showExtensionNote']:[]),...(['dependency','usage','trace','refine'].includes(k)?['dependencyContext']:[]),...(k==='annotation'?['annotationTargetEdgeId']:[])]
   for(const [field,value] of Object.entries(e))if(value!==undefined&&!allowed.includes(field))add(key,'Propiedad de relación incompatible: '+field)
   if(!validUmlEdgeNotation(d.type,e))add(key,'Notación UML inválida')
   if(umlRelationNameLocked(d.type,k)&&e.label )add(key,'Nombre reservado UML')
   if(k==='association'){if(!validMultiplicity(e.sourceMultiplicity)||!validMultiplicity(e.targetMultiplicity))add(key,'Multiplicidad inválida');if(a.type==='usecase'&&b.type==='usecase'&&!disjoint(doc,a,b))add(key,'Asociación de casos requiere sujetos conocidos y disjuntos')}
   if(k==='generalization'&&((b.useCaseDetail?.leaf??b.uml?.leaf)))add(key,'No se puede especializar un clasificador final')
   if(k==='extend'){const points=e.extensionPointIds||[];if(!points.length||new Set(points).size!==points.length||points.some(id=>!b.useCaseDetail?.extensionPoints?.some(p=>p.id===id)))add(key,'Selecciona puntos de extensión válidos del caso destino')}
   if(['dependency','usage','trace','refine'].includes(k)&&!e.dependencyContext?.trim())add(key,'Indica el contexto de dependencia')
   if(e.annotationTargetEdgeId){const anchor=d.edges.find(x=>x.id===e.annotationTargetEdgeId&&x.id!==e.id&&x.relationKind!=='annotation');if(!anchor)add(key,'Relación anotada inexistente');else if(k==='annotation'&&e.target!==anchor.source)add(key,'Destino auxiliar de anotación incompatible con la relación anotada')}
   if(k==='annotation'&&e.semanticRelationId&&registry&&Object.hasOwn(registry,e.semanticRelationId))add(key,'La anotación es una ocurrencia local, no una relación semántica')
   if(registry&&k!=='annotation'){const r=e.semanticRelationId&&Object.hasOwn(registry,e.semanticRelationId)?registry[e.semanticRelationId]:undefined;if(!r)add(key,'Identidad semántica requerida');else if(recordSignature(r)!==signature(d,e))add(key,r.sourceElementId!==a.id||r.targetElementId!==b.id?'Los extremos semánticos del registro no coinciden con la aparición':'Relación compartida divergente del registro semántico')}
   if(e.semanticRelationId&&k!=='annotation'){const sig=signature(d,e),old=shared.get(e.semanticRelationId);if(old!==undefined&&old!==sig)add(key,'Relación compartida divergente');shared.set(e.semanticRelationId,sig)}
   if(k==='include'||k==='generalization'){const graph=arcs.get(k)||new Map<string,Set<string>>();const next=graph.get(a.id)||new Set<string>();next.add(b.id);graph.set(a.id,next);arcs.set(k,graph);relations.push({key,kind:k,a:a.id,b:b.id})}
  }
 }
 for(const r of relations)if(reaches(arcs.get(r.kind)!,r.b,r.a))add(r.key,'Ciclo de '+r.kind)
 return out
}
export function newUseCaseIssues(before:ProjectDocument,after:ProjectDocument):UseCaseIssue[]{const old=new Set(useCaseDocumentIssues(before).map(x=>JSON.stringify(x)));return useCaseDocumentIssues(after).filter(i=>{if(!old.has(JSON.stringify(i)))return true;const [kind,a,b]=i.key.split(':');const record=(doc:ProjectDocument)=>i.key.startsWith('edge:@semantic/')?doc.useCaseRelations?.[i.key.slice('edge:@semantic/'.length,-':semantic'.length)]:kind==='element'?doc.elements[a]:kind==='edge'?doc.diagrams.find(d=>d.id===a)?.edges.find(e=>e.id===b):doc.diagrams.find(d=>d.id===a)?.nodes.find(n=>n.id===b);return JSON.stringify(record(before))!==JSON.stringify(record(after))})}
/** Update semantics, retaining each occurrence's geometry and node IDs. */
export function replaceUseCaseRelation(doc:ProjectDocument,diagramId:string,edge:DiagramEdge):ProjectDocument{
 doc=adaptUseCaseDocument(doc);const view=doc.diagrams.find(d=>d.id===diagramId);if(!view)throw Error('Vista inexistente');const previous=view.edges.find(e=>e.id===edge.id),semanticRelationId=edge.relationKind==='annotation'?undefined:previous?.semanticRelationId||edge.semanticRelationId||edge.id,next={...edge,semanticRelationId};const relation=useCaseRelationRecord(view,next);const registry=relation?{...doc.useCaseRelations,[relation.id]:relation}:doc.useCaseRelations
 return {...doc,...(registry?{useCaseRelations:registry}:{}),diagrams:doc.diagrams.map(d=>{if(d.type!=='uml-usecase')return d;const edges=d.edges.map(e=>{if(d.id===diagramId&&e.id===edge.id)return next;if(!semanticRelationId||e.semanticRelationId!==semanticRelationId)return e;const result={...e};for(const k of semanticKeys)Object.assign(result,{[k]:next[k]});result.direction=next.direction;result.lineStyle=next.lineStyle;return result});return {...d,edges:d.id===diagramId&&!previous?[...edges,next]:edges}})}
}
/** Advisory only: extend and mixed include/extend cycles do not block saving. */
export function useCaseDesignWarnings(doc:ProjectDocument):string[]{
 const graph=new Map<string,Set<string>>(),extensions:{a:string;b:string}[]=[]
 for(const r of Object.values(useCaseRegistry(doc))){if(r.relationKind!=='extend'&&r.relationKind!=='include')continue;const a=r.sourceElementId,b=r.targetElementId;const targets=graph.get(a)||new Set<string>();targets.add(b);graph.set(a,targets);if(r.relationKind==='extend')extensions.push({a,b})}
 return extensions.some(({a,b})=>reaches(graph,b,a))?['Ciclo de extensión o combinación include/extend: revisa el comportamiento.']:[]
}
