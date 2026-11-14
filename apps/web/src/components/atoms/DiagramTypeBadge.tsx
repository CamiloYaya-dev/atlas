import type {DiagramType} from '@atlas/contracts'
const short:Record<DiagramType,string>={c1:'C1',c2:'C2',c3:'C3',c4:'C4',process:'PROC',sequence:'SEQ',data:'DATA',trace:'TRAZ',custom:'LIBRE','uml-class':'U·CL','uml-object':'U·OBJ','uml-component':'U·COMP','uml-composite':'U·EC','uml-deployment':'U·DEP','uml-package':'U·PKG','uml-profile':'U·PROF','uml-usecase':'U·UC','uml-activity':'U·ACT','uml-state':'U·EST','uml-sequence':'U·SEQ','uml-communication':'U·COM','uml-interaction-overview':'U·OV','uml-timing':'U·TMP'}
/** El nivel C4 está siempre visible, incluso si el nombre del diagrama es libre. */
export function DiagramTypeBadge({type}:{type:DiagramType}){
 return <span className={`diagram-type-badge level-${type}`} title={`Tipo de diagrama: ${type.toUpperCase()}`} aria-label={`Tipo ${type.toUpperCase()}`}>{short[type]}</span>
}
