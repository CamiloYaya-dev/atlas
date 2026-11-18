import type {ElementType} from './index'
export const COMPONENT_TYPES:readonly ElementType[]=['component','uml-interface','uml-port','uml-artifact','uml-package','uml-part','uml-reference-role','uml-class','uml-datatype','uml-comment','uml-constraint']
export const COMPONENT_RELATIONS=['assembly','wiring','connector','delegation','provided-interface','required-interface','dependency','usage','realization','component-realization','generalization','manifestation','import','access','merge','elementImport','elementAccess','packageImport','packageAccess','containment','annotation'] as const
export const componentRole=(t?:ElementType)=>t==='uml-part'||t==='uml-reference-role'
export const componentClassifier=(t?:ElementType)=>t==='component'||t==='uml-class'
export const contractType=(t?:ElementType)=>componentClassifier(t)||t==='uml-interface'||t==='uml-datatype'
export const auxiliary=(t:ElementType)=>t==='uml-comment'||t==='uml-constraint'
export const connectable=(t:ElementType)=>componentRole(t)||t==='uml-port'
export const external=(t:ElementType)=>t==='component'||t==='uml-port'
export const packageable=(t:ElementType)=>['component','uml-interface','uml-class','uml-datatype','uml-artifact','uml-package'].includes(t)
export function componentEndpointValid(kind:string,a:ElementType,b:ElementType):boolean{
 if(!COMPONENT_TYPES.includes(a)||!COMPONENT_TYPES.includes(b))return false
 switch(kind){
 case 'dependency':return !auxiliary(a)&&!auxiliary(b)
 case 'usage':case 'realization':return componentClassifier(a)&&b==='uml-interface'
 case 'component-realization':return componentClassifier(a)&&b==='component'
 case 'generalization':return a===b&&['component','uml-interface','uml-class'].includes(a)
 case 'provided-interface':case 'required-interface':return external(a)&&b==='uml-interface'
 case 'wiring':return external(a)&&external(b)
 case 'assembly':return external(a)&&external(b)||connectable(a)&&connectable(b)
 case 'connector':case 'delegation':return connectable(a)&&connectable(b)
 case 'manifestation':return a==='uml-artifact'&&packageable(b)
 case 'import':case 'access':case 'merge':case 'packageImport':case 'packageAccess':return a==='uml-package'&&b==='uml-package'
 case 'elementImport':case 'elementAccess':return a==='uml-package'&&packageable(b)
 case 'containment':return a==='uml-package'&&packageable(b)||a==='uml-artifact'&&b==='uml-artifact'||componentClassifier(a)&&connectable(b)
 case 'annotation':return auxiliary(a)
 default:return false
 }
}
export const COMPONENT_PORT_SIZE={width:16,height:16} as const
