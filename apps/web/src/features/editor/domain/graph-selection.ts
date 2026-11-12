import type {Diagram,DiagramFilter,DiagramNode,ProjectDocument} from '@atlas/contracts'
/** The model's filters belong to the DIAGRAM, not the globally reusable element.
 * Historical process diagrams used ModelElement.group; preserve them without
 * adding any default categories to new diagrams. */
export function diagramFilters(diagram:Diagram,doc:ProjectDocument):DiagramFilter[]{
 const configured=diagram.filters||[]
 if(diagram.type!=='process')return configured
 const ids=new Set(configured.map(f=>f.id))
 const legacy:string[]=[]
 for(const node of diagram.nodes){
  if(node.filterIds!==undefined)continue
  const group=doc.elements[node.elementId]?.group?.trim()
  if(group&&!ids.has(group)&&!legacy.includes(group))legacy.push(group)
 }
 return [...configured,...legacy.map(group=>({id:group,label:group}))]
}
export function nodeFilterIds(node:DiagramNode,diagram:Diagram,doc:ProjectDocument):string[]{
 if(node.filterIds!==undefined)return node.filterIds
 const legacy=diagram.type==='process'?doc.elements[node.elementId]?.group?.trim():undefined
 return legacy?[legacy]:[]
}
/** Returns visible node/edge IDs for every type of ATLAS diagram, with optional
 * one-hop dependency context. Without diagram filters ALL nodes remain visible. */
export function graphSelection(diagram:Diagram,doc:ProjectDocument,groups:readonly string[],dependencies:boolean,includeUntagged=true){
 const configured=diagramFilters(diagram,doc)
 const selected=new Set(groups)
 const visible=new Set<string>()
 for(const node of diagram.nodes){
  if(!doc.elements[node.elementId])continue
  const tags=nodeFilterIds(node,diagram,doc)
  if(!configured.length||(!tags.length&&includeUntagged)||tags.some(t=>selected.has(t)))visible.add(node.id)
 }
 // Only expand dependencies when at least one node was already selected, to
 // avoid turning "all filters off" into an accidental full document view.
 if(dependencies&&configured.length&&visible.size){
  const direct=new Set(visible)
  for(const edge of diagram.edges)if(direct.has(edge.source)||direct.has(edge.target)){
   visible.add(edge.source);visible.add(edge.target)
  }
 }
 const nodeIds=diagram.nodes.filter(n=>visible.has(n.id)&&doc.elements[n.elementId]).map(n=>n.id)
 const ids=new Set(nodeIds)
 const edgeIds=diagram.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>e.id)
 return {nodeIds,edgeIds}
}
