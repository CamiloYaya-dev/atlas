import type {ElementType} from './index'
export const CLASS_TYPES=['uml-class','uml-interface','uml-enumeration','uml-package','uml-datatype','uml-primitive','uml-signal','uml-association-class','uml-comment','uml-constraint','uml-model'] as const satisfies readonly ElementType[]
export const ASSOCIATION_KINDS=['association','navigable-association','bidirectional-association','aggregation','composition'] as const
export const CLASS_RELATIONS=[...ASSOCIATION_KINDS,'generalization','realization','specification-realization','dependency','usage','import','packageImport','elementImport','access','elementAccess','packageAccess','merge','abstraction','trace','refine','derive','containment','annotation','bind'] as const
export const CLASS_IMPORT_KINDS=['import','access','packageImport','elementImport','elementAccess','packageAccess'] as const
export const isClassImport=(kind:string)=>CLASS_IMPORT_KINDS.some(k=>k===kind)
export const classImportAliasAllowed=(kind:string)=>['elementImport','elementAccess','access'].includes(kind)
export const CLASS_FAMILIES:Readonly<Record<string,string>>=Object.fromEntries(CLASS_RELATIONS.map(k=>[k,ASSOCIATION_KINDS.some(x=>x===k)?'Asociación':k==='generalization'?'Generalización':k.includes('realization')?'Realización':k==='containment'?'Contención':k==='annotation'?'Anotación':k==='bind'?'Plantilla':isClassImport(k)?'Importación':'Dependencia']))
