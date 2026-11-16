/** Layout semántico de secuencia: activaciones y destrucciones quedan ancladas
 * a un participante (línea de vida) o a una activación, nunca como cajas sueltas.
 * La posición local se conserva en el JSON; esta función es pura y compartida.
 */
import type {Diagram,DiagramNode,ElementType,ProjectDocument} from './index'

export const sequenceIsParticipant=(type:ElementType)=>type==='uml-lifeline'||type==='actor'
export const sequenceIsAttachment=(type:ElementType)=>type==='uml-activation'||type==='uml-destruction'

export function sequenceSnapChild(parent:ElementType,child:ElementType,
 parentSize:{width:number;height:number},childSize:{width:number;height:number},requestedY:number){
 if(!sequenceIsAttachment(child))throw new Error('El elemento no es un acople de secuencia')
 if(!Number.isFinite(requestedY))throw new Error('Posición de secuencia inválida')
 const x=Math.round((parentSize.width-childSize.width)/2)
 if(child==='uml-destruction')return {x,y:Math.round(parentSize.height-childSize.height/2)}
 if(!sequenceIsParticipant(parent))throw new Error('La activación pertenece a un participante')
 if(parentSize.height<childSize.height+64)throw new Error('La línea de vida es demasiado corta para esta activación')
 return {x,y:Math.round(Math.max(55,Math.min(parentSize.height-childSize.height-9,requestedY)))}
}

/** An Interaction root alone does not resolve the geometry of every symbol.
 * Preserve draft/legacy attachment placement until an occurrence is referenced.
 * A partially resolved symbol or a timed descendant must never use legacy snapping.
 */
export function sequencePositionLocked(doc:ProjectDocument,d:Diagram,n:DiagramNode):boolean{
 if(d.type!=='uml-sequence'||!d.interaction)return false
 const type=doc.elements[n.elementId]?.type
 if(type==='uml-gate'||type==='uml-sequence-invariant')return true
 if(!type||!sequenceIsAttachment(type))return false
 const ids=new Set([n.id]);let count=-1
 while(count!==ids.size){count=ids.size;for(const child of d.nodes)if(child.parentNodeId&&ids.has(child.parentNodeId))ids.add(child.id)}
 return d.interaction.occurrences.some(o=>ids.has(o.nodeId))||d.nodes.some(child=>{
  if(!ids.has(child.id))return false
  const detail=doc.elements[child.elementId]?.sequenceDetail
  return !!(detail?.startOccurrenceId||detail?.finishOccurrenceId||detail?.occurrenceId)
 })
}
