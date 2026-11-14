import type {DiagramType,ElementType} from './index'
export const DIAGRAM_KINDS=['c1','c2','c3','c4','process','sequence','data','trace','custom','uml-class','uml-object','uml-component','uml-composite','uml-deployment','uml-package','uml-profile','uml-usecase','uml-activity','uml-state','uml-sequence','uml-communication','uml-interaction-overview','uml-timing'] as const satisfies readonly DiagramType[]
export const ELEMENT_KINDS=['system','actor','container','component','service','endpoint','process','activity','usecase','requirement','database','external','event','document','uml-class','uml-interface','uml-enumeration','uml-object','uml-package','uml-node','uml-artifact','uml-device','uml-execution','uml-port','uml-part','uml-reference-role','uml-collaboration','uml-profile','uml-stereotype','uml-action','uml-decision','uml-start','uml-end','uml-fork','uml-state','uml-transition','uml-lifeline','uml-message','uml-interaction','uml-time','uml-constraint','uml-frame','uml-signal','uml-region'] as const satisfies readonly ElementType[]
export const RELATION_KINDS=['functional','technical','mixed'] as const
export const GLOBAL_ACTIONS=['project.read','project.create','project.rename','project.delete','project.members.manage','workspace.rename','workspace.delete','element.technical.view','element.technical.edit','field.configure','artifact.import','artifact.export','workspace.members.manage','workspace.roles.manage','workspace.audit.view'] as const
export const PERMISSIONS = [
 ...GLOBAL_ACTIONS,
 ...DIAGRAM_KINDS.flatMap(t=>['view','create','edit','delete','layout'].map(a=>`diagram.${a}.${t}`)),
 ...ELEMENT_KINDS.flatMap(t=>['view','create','edit','delete'].map(a=>`element.${a}.${t}`)),
 ...RELATION_KINDS.flatMap(t=>['create','edit','delete'].map(a=>`relation.${a}.${t}`)),
] as const
export type Permission=string
export type PermissionScope='functional'|'technical'|'mixed'
export const ELEMENT_SCOPE:Record<ElementType,PermissionScope> = {
 system:'mixed', actor:'mixed', container:'technical',component:'technical',service:'technical',endpoint:'technical',
 process:'functional',activity:'functional',usecase:'functional',requirement:'functional',database:'technical',
 external:'mixed',event:'mixed',document:'mixed','uml-class':'technical','uml-interface':'technical','uml-enumeration':'technical','uml-object':'technical','uml-package':'technical','uml-node':'technical','uml-artifact':'technical','uml-device':'technical','uml-execution':'technical','uml-port':'technical','uml-part':'technical','uml-reference-role':'technical','uml-collaboration':'technical','uml-profile':'technical','uml-stereotype':'technical','uml-action':'functional','uml-decision':'functional','uml-start':'functional','uml-end':'functional','uml-fork':'functional','uml-state':'functional','uml-transition':'functional','uml-lifeline':'technical','uml-message':'functional','uml-interaction':'functional','uml-time':'technical','uml-constraint':'technical','uml-frame':'technical','uml-signal':'functional','uml-region':'functional'
}
export function relationScope(a:ElementType,b:ElementType):PermissionScope {
 const x=ELEMENT_SCOPE[a], y=ELEMENT_SCOPE[b]
 return x===y?x:'mixed'
}
export const ROLE_PRESETS:{key:string;name:string;description:string;permissions:string[]}[]=[
 {key:'owner',name:'Propietario',description:'Control completo del espacio',permissions:[...PERMISSIONS]},
 {key:'admin',name:'Administrador',description:'Gestión de usuarios, roles, diagramas y modelos',permissions:PERMISSIONS.filter(p=>p!=='workspace.delete')},
 {key:'functional',name:'Analista funcional',description:'Procesos, casos de uso y requerimientos',permissions:[
  'project.read','project.create',...['c1','process','trace','sequence','custom','uml-usecase','uml-activity','uml-state'].map(x=>`diagram.view.${x}`),
  ...['process','trace','custom','uml-usecase','uml-activity','uml-state'].flatMap(x=>['create','edit','delete','layout'].map(a=>`diagram.${a}.${x}`)),
  ...['process','activity','usecase','requirement','actor','system','event','external','document','uml-action','uml-decision','uml-start','uml-end','uml-fork','uml-state','uml-transition'].map(x=>`element.view.${x}`),
  ...['process','activity','usecase','requirement','actor','uml-action','uml-decision','uml-start','uml-end','uml-fork','uml-state','uml-transition'].flatMap(x=>['create','edit','delete'].map(a=>`element.${a}.${x}`)),
  ...['create','edit','delete'].map(a=>`relation.${a}.functional`),...['create','edit','delete'].map(a=>`relation.${a}.mixed`),
 ]},
 {key:'technical',name:'Arquitecto técnico',description:'Arquitectura, componentes, APIs y datos',permissions:[
  'project.read','project.create','element.technical.view','element.technical.edit',...['c1','c2','c3','c4','sequence','data','custom',...DIAGRAM_KINDS.filter(x=>x.startsWith('uml-'))].map(x=>`diagram.view.${x}`),
  ...['c2','c3','c4','data','sequence','custom',...DIAGRAM_KINDS.filter(x=>x.startsWith('uml-'))].flatMap(x=>['create','edit','delete','layout'].map(a=>`diagram.${a}.${x}`)),
  ...['system','actor','container','component','service','endpoint','database','event','external','document',...ELEMENT_KINDS.filter(x=>x.startsWith('uml-'))].map(x=>`element.view.${x}`),
  ...['container','component','service','endpoint','database','actor','usecase',...ELEMENT_KINDS.filter(x=>x.startsWith('uml-'))].flatMap(x=>['create','edit','delete'].map(a=>`element.${a}.${x}`)),
  ...['create','edit','delete'].map(a=>`relation.${a}.technical`),...['create','edit','delete'].map(a=>`relation.${a}.mixed`),
 ]},
 {key:'viewer',name:'Lector',description:'Solo consulta de vistas autorizadas',permissions:[
  'project.read',...['c1','process','trace'].map(x=>`diagram.view.${x}`),
  ...ELEMENT_KINDS.map(x=>`element.view.${x}`)
 ]}
]
export const permissionLabel=(key:string):string=>{
 const [group,action,target]=key.split('.')
 const labels:Record<string,string>={view:'Ver',create:'Crear',edit:'Editar',delete:'Eliminar',layout:'Mover cajas',read:'Consultar',rename:'Renombrar',import:'Importar',export:'Exportar',configure:'Configurar',manage:'Administrar',members:'Miembros',roles:'Roles',audit:'Auditoría'}
 if(group==='workspace')return ({rename:'Renombrar espacio',delete:'Eliminar espacio',members:'Administrar miembros del espacio',roles:'Administrar roles del espacio',audit:'Consultar auditoría del espacio'} as Record<string,string>)[action]||key.replace(/\./g,' · ')
 if(group==='project')return ({read:'Consultar proyecto asignado',create:'Crear proyectos en el espacio',rename:'Renombrar proyecto',delete:'Eliminar proyecto',members:'Administrar usuarios del proyecto'} as Record<string,string>)[action]||key.replace(/\./g,' · ')
 if(group==='diagram')return `${labels[action]||action} vista ${target?.toUpperCase()}`
 if(group==='element')return `${labels[action]||action} ${target}`
 if(group==='relation')return `${labels[action]||action} relaciones ${target}`
 return key.replace(/\./g,' · ')
}
