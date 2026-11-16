import type {ElementType} from './index'
export const USECASE_CONTEXT=['uml-class','uml-interface','uml-enumeration','uml-datatype','uml-primitive','uml-association-class','uml-signal','component'] as const
// UC-01 / UC-09: context classifiers can be represented by reuse, not created in this palette.
export const USECASE_CREATION_TYPES:readonly ElementType[]=['actor','usecase','uml-subject','uml-comment','uml-constraint']
export const USECASE_TYPES:readonly ElementType[]=[...USECASE_CREATION_TYPES,...USECASE_CONTEXT]
export const USECASE_RELATIONS=['association','include','extend','generalization','dependency','usage','trace','refine','annotation'] as const
const primary=(t:ElementType)=>t==='actor'||t==='usecase'
export const useCaseContext=(t:ElementType)=>USECASE_CONTEXT.some(x=>x===t)
const auxiliary=(t:ElementType)=>t==='uml-comment'||t==='uml-constraint'
export function useCaseEndpointValid(kind:string,a:ElementType,b:ElementType):boolean{
 if(kind==='annotation')return auxiliary(a)&&(primary(b)||useCaseContext(b)||b==='uml-subject'||auxiliary(b))
 if(kind==='generalization')return primary(a)&&a===b
 if(kind==='include'||kind==='extend')return a==='usecase'&&b==='usecase'
 if(kind==='association')return a==='usecase'&&(primary(b)||useCaseContext(b))||b==='usecase'&&(primary(a)||useCaseContext(a))||a==='actor'&&['uml-class','component','uml-association-class'].includes(b)||b==='actor'&&['uml-class','component','uml-association-class'].includes(a)
 return ['dependency','usage','trace','refine'].includes(kind)&&(a==='usecase'&&b==='usecase'||primary(a)&&useCaseContext(b)||primary(b)&&useCaseContext(a))
}
