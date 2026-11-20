import {activityReferences,componentReferences,componentRelationDependencies,componentRelationRefs,deploymentDetailRefs,deploymentRefs,sequenceReferences} from '@novzi/contracts'
import type {ProjectDocument,ModelElement} from '@novzi/contracts'

/** Build a portable document containing exactly the requested view and only its
 * semantic dependencies. Never dump the entire project catalog in a diagram export.
 * A cross-view navigation cannot work in a one-view file and is intentionally
 * omitted from the importable document. The source project is never mutated. */
export function createStandaloneDiagramDocument(source:ProjectDocument,diagramId:string):ProjectDocument{
 const diagram=source.diagrams.find(d=>d.id===diagramId)
 if(!diagram)throw new Error('El diagrama seleccionado no existe')
 const required=new Set<string>()
 const pending:string[]=[]
 const add=(id:string|undefined|null)=>{if(id&&source.elements[id]&&!required.has(id)){required.add(id);pending.push(id)}}
 for(const node of diagram.nodes)add(node.elementId)
 for(const p of [...(diagram.activity?.parameters||[]),...(diagram.interaction?.parameters||[])])add(p.typeId)
 add(diagram.interaction?.contextId)
 for(const edge of diagram.edges){
  add(edge.associationClassId)
  add(edge.sequenceEdge?.signatureOwnerId)
  for(const a of edge.sequenceEdge?.arguments||[])add(a.typeId)
  for(const binding of edge.templateBindings||[])add(binding.elementId)
  add(edge.activityEdge?.interruptingRegionId)
  for(const id of edge.activityEdge?.exceptionTypeIds||[])add(id)
 }
 // Keep only registries used by this diagram and their dependencies.
 const componentIds=new Set(diagram.edges.map(e=>e.componentRelationId).filter((id):id is string=>!!id&&!!source.componentRelations?.[id]))
 for(const id of componentIds){
  const record=source.componentRelations?.[id]
  if(!record)continue
  for(const dep of componentRelationDependencies(record))if(source.componentRelations?.[dep])componentIds.add(dep)
 }
 const deploymentIds=new Set(diagram.edges.map(e=>e.deploymentRelationId).filter((id):id is string=>!!id&&!!source.deploymentRelations?.[id]))
 for(const id of componentIds)for(const ref of componentRelationRefs(source.componentRelations![id]))add(ref)
 for(const id of deploymentIds)for(const ref of deploymentRefs(source.deploymentRelations![id]))add(ref)
 for(let cursor=0;cursor<pending.length;cursor++){
  const e:ModelElement=source.elements[pending[cursor]]
  add(e.semanticOwnerId)
  add(e.useCaseDetail?.classifierId)
  for(const id of e.useCaseDetail?.subjectIds||[])add(id)
  for(const id of activityReferences(e.activityDetail))add(id)
  for(const id of sequenceReferences(e.sequenceDetail,source))add(id)
  for(const id of componentReferences(e.uml?.component))add(id)
  for(const id of deploymentDetailRefs(e.uml?.deployment))add(id)
  for(const attr of e.uml?.attributes||[])add(attr.typeId)
  for(const op of e.uml?.operations||[]){add(op.returnTypeId);for(const param of op.parameters)add(param.typeId)}
  for(const param of e.uml?.templateParameters||[])add(param.typeId)
 }
 // An element linked to a different diagram becomes a local, unlinked ficha.
 // A standalone import must not refer to a view absent from its document.
 const elements:Record<string,ModelElement>=Object.fromEntries([...required].map(id=>{
  const copy=structuredClone(source.elements[id])
  if(copy.childDiagramId!==diagram.id){delete copy.childDiagramId;delete copy.childNodeId}
  return [id,copy]
 }))
 const kinds=new Set(Object.values(elements).map(e=>e.type))
 const fieldDefinitions=source.fieldDefinitions.filter(f=>f.forType==='all'||kinds.has(f.forType))
 const useCaseRelations=source.useCaseRelations===undefined?undefined:Object.fromEntries(Object.entries(source.useCaseRelations).filter(([,r])=>required.has(r.sourceElementId)&&required.has(r.targetElementId)))
 const componentRelations=source.componentRelations===undefined?undefined:Object.fromEntries(Object.entries(source.componentRelations).filter(([id])=>componentIds.has(id)))
 const deploymentRelations=source.deploymentRelations===undefined?undefined:Object.fromEntries(Object.entries(source.deploymentRelations).filter(([id])=>deploymentIds.has(id)))
 return {schema:1,elements,diagrams:[structuredClone(diagram)],fieldDefinitions,
  ...(useCaseRelations===undefined?{}:{useCaseRelations}),
  ...(componentRelations===undefined?{}:{componentRelations}),
  ...(deploymentRelations===undefined?{}:{deploymentRelations})}
}
