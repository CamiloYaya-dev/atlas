/** Layout semántico de secuencia: activaciones y destrucciones quedan ancladas
 * a un participante (línea de vida) o a una activación, nunca como cajas sueltas.
 * La posición local se conserva en el JSON; esta función es pura y compartida.
 */
import type {ElementType} from './index'

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
