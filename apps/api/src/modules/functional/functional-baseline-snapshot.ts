/** Construye una copia separada y acotada de los diagramas enlazados. */
import type {ProjectDocument} from '@novzi/contracts'

export function snapshotDiagrams(doc:ProjectDocument,diagramIds:ReadonlySet<string>):ProjectDocument{
 const diagrams=doc.diagrams.filter(d=>diagramIds.has(d.id))
 const usedElements=new Set(diagrams.flatMap(d=>d.nodes.map(n=>n.elementId)))
 const relations=new Set(diagrams.flatMap(d=>d.edges.map(e=>e.semanticRelationId).filter((x):x is string=>!!x)))
 const components=new Set(diagrams.flatMap(d=>d.edges.map(e=>e.componentRelationId).filter((x):x is string=>!!x)))
 const deployment=new Set(diagrams.flatMap(d=>d.edges.map(e=>e.deploymentRelationId).filter((x):x is string=>!!x)))
 const picked=<T>(source:Record<string,T>|undefined,keys:Set<string>)=>Object.fromEntries(Object.entries(source||{}).filter(([key])=>keys.has(key)).map(([key,value])=>[key,structuredClone(value)])) as Record<string,T>
 return {
  schema:1,diagrams:structuredClone(diagrams),elements:picked(doc.elements,usedElements),fieldDefinitions:structuredClone(doc.fieldDefinitions),
  useCaseRelations:picked(doc.useCaseRelations,relations),componentRelations:picked(doc.componentRelations,components),deploymentRelations:picked(doc.deploymentRelations,deployment)
 }
}
export function comparisonForBaseline(history:ProjectDocument,live:ProjectDocument|null){
 return history.diagrams.map(old=>{const current=live?.diagrams.find(d=>d.id===old.id);return {
  id:old.id,name:old.name,oldNodes:old.nodes.length,oldEdges:old.edges.length,
  currentNodes:current?.nodes.length??null,currentEdges:current?.edges.length??null,
  changed:!current||JSON.stringify(old)!==JSON.stringify(current)||old.nodes.some(n=>JSON.stringify(history.elements[n.elementId])!==JSON.stringify(live?.elements[n.elementId]))
 }})
}
