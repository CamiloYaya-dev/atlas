import type {Diagram,ProjectDocument} from '@atlas/contracts'
/** Computes the displayed process and dependency slice; used by React Flow and unit tests. */
export function graphSelection(diagram:Diagram,doc:ProjectDocument,groups:readonly string[],dependencies:boolean){
 const visible=new Set<string>()
 if(diagram.type==='process'){
  for(const node of diagram.nodes){const e=doc.elements[node.elementId];if(e&&(!e.group||groups.includes(e.group)))visible.add(node.id)}
  if(dependencies)for(const edge of diagram.edges)if(visible.has(edge.source)||visible.has(edge.target)){
   visible.add(edge.source);visible.add(edge.target)
  }
 }else for(const node of diagram.nodes)visible.add(node.id)
 const nodeIds=diagram.nodes.filter(n=>visible.has(n.id)&&doc.elements[n.elementId]).map(n=>n.id)
 const ids=new Set(nodeIds)
 const edgeIds=diagram.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>e.id)
 return {nodeIds,edgeIds}
}
