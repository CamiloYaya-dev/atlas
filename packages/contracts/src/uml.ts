import {USECASE_CREATION_TYPES,USECASE_TYPES,USECASE_RELATIONS,useCaseEndpointValid} from './uml-usecase-catalog'
import {CLASS_TYPES,CLASS_RELATIONS} from './uml-class-catalog'
import {classEndpointValid} from './uml-class-policy'
/** Catálogo orientado a UML 2.5.1, para el editor visual de ATLAS.
 * Tipos y restricciones persistidos; no constituye un motor de validación UML formal.
 */
import type {DiagramType,ElementType} from './index'
export const UML_DIAGRAM_GROUPS = [
 {title:'UML · Estructura (7)',types:['uml-class','uml-object','uml-component','uml-composite','uml-deployment','uml-package','uml-profile']},
 {title:'UML · Comportamiento (3)',types:['uml-usecase','uml-activity','uml-state']},
 {title:'UML · Interacción (4)',types:['uml-sequence','uml-communication','uml-interaction-overview','uml-timing']}
] as const
export const UML_DIAGRAMS=UML_DIAGRAM_GROUPS.flatMap(group=>group.types) as DiagramType[]
export const UML_ELEMENTS_BY_DIAGRAM:Partial<Record<DiagramType,readonly ElementType[]>>={
 'uml-class':CLASS_TYPES,
 'uml-object':['uml-object','uml-class','uml-package'],
 'uml-component':['component','uml-interface','uml-port','uml-artifact','uml-package'],
 'uml-composite':['uml-class','uml-part','uml-reference-role','uml-port','uml-collaboration','uml-interface'],
 'uml-deployment':['uml-node','uml-device','uml-execution','uml-artifact'],
 'uml-package':['uml-package','uml-subpackage','uml-model','uml-profile'],
 'uml-profile':['uml-profile','uml-stereotype','uml-metaclass','uml-package'],
 'uml-usecase':USECASE_TYPES,
 'uml-activity':['uml-start','uml-action','uml-decision','uml-fork','uml-end','uml-flow-final','uml-object-node','uml-partition'],
 'uml-state':['uml-start','uml-state','uml-end','uml-region','uml-decision','uml-fork','uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point','uml-terminate'],
 'uml-sequence':['uml-lifeline','uml-frame','uml-interaction','uml-activation','uml-destruction'],
 'uml-communication':['actor','uml-object','uml-lifeline','uml-frame'],
 'uml-interaction-overview':['uml-start','uml-interaction','uml-decision','uml-end','uml-frame'],
 'uml-timing':['uml-lifeline','uml-state','uml-time','uml-constraint'],
}
export const UML_RELATIONS_BY_DIAGRAM:Partial<Record<DiagramType,readonly string[]>>={
 'uml-class':CLASS_RELATIONS,
 'uml-object':['link','dependency'],
 'uml-component':['assembly','provided-interface','required-interface','dependency','realization'],
 'uml-composite':['connector','assembly'],
 'uml-deployment':['communication-path','deployment'],
 'uml-package':['dependency','import','merge'],
 'uml-profile':['extension','apply','reference','generalization'],
 'uml-usecase':USECASE_RELATIONS,
 'uml-activity':['control-flow','object-flow'],
 'uml-state':['transition','trigger','completion','generalization'],
 'uml-sequence':['message','reply','async-message','create','destroy'],
 'uml-communication':['message','reply','async-message','link'],
 'uml-interaction-overview':['control-flow','interaction-ref','decision'],
 'uml-timing':['timing-transition','duration','constraint'],
}
/** El catálogo visible es estricto; el backend sigue leyendo los modelos previos de ATLAS sin borrarlos. */
export const UML_LEGACY_ELEMENTS:Partial<Record<DiagramType,readonly ElementType[]>>={
 'uml-deployment':['database'],
 'uml-usecase':['system','requirement'],
 'uml-profile':['uml-class','uml-constraint','uml-model'],
 'uml-activity':['uml-signal'],
 'uml-state':['uml-transition'],
 'uml-sequence':['actor','uml-message'],
 'uml-communication':['uml-message'],
 'uml-package':['uml-class','uml-interface','component']
}
export const UML_LEGACY_RELATIONS:Partial<Record<DiagramType,readonly string[]>>={
 'uml-composite':['composition','delegation'],
 'uml-deployment':['manifestation','dependency'],
 'uml-package':['containment'],
 'uml-profile':['stereotype-application','dependency'],
 'uml-activity':['fork','join','exception']
}
/** Catalog for an occurrence, including reusable context but excluding read-only legacy. */
export const umlElementReusable=(diagram:DiagramType,element:ElementType):boolean=>!UML_ELEMENTS_BY_DIAGRAM[diagram]||UML_ELEMENTS_BY_DIAGRAM[diagram]!.includes(element)
/** Native element creation is narrower than representation in use-case diagrams. */
export const umlElementCreatable=(diagram:DiagramType,element:ElementType):boolean=>diagram==='uml-usecase'?USECASE_CREATION_TYPES.includes(element):umlElementReusable(diagram,element)
export const umlRelationCreatable=(diagram:DiagramType,relation:string):boolean=>!UML_RELATIONS_BY_DIAGRAM[diagram]||UML_RELATIONS_BY_DIAGRAM[diagram]!.includes(relation)
export const umlElementAllowed=(diagram:DiagramType,element:ElementType):boolean=>umlElementReusable(diagram,element)||!!UML_LEGACY_ELEMENTS[diagram]?.includes(element)
export const umlRelationAllowed=(diagram:DiagramType,relation:string):boolean=>umlRelationCreatable(diagram,relation)||!!UML_LEGACY_RELATIONS[diagram]?.includes(relation)
/** Etiquetas formativas; el valor persistido sigue siendo la clave UML estable. */
export const UML_RELATION_LABELS:Record<string,string>={
 association:'Asociación — línea continua, sin navegabilidad',
 'navigable-association':'Asociación navegable — flecha abierta',
 'bidirectional-association':'Asociación navegable en ambos sentidos — flechas abiertas',link:'Enlace entre instancias — línea continua',
 generalization:'Generalización / herencia — triángulo hueco',
 realization:'Realización — línea discontinua y triángulo hueco',
 aggregation:'Agregación — rombo blanco',composition:'Composición — rombo negro',
 elementImport:'Importación pública de elemento — «import»',elementAccess:'Importación privada de elemento — «access»',packageImport:'Importación pública de miembros de paquete — «import»',packageAccess:'Importación privada de miembros de paquete — «access»',
 dependency:'Dependencia — línea discontinua y flecha abierta',
 assembly:'Ensamblaje de interfaces — bola y encaje',
 'provided-interface':'Interfaz proporcionada — círculo (lollipop)',
 'required-interface':'Interfaz requerida — semicírculo (socket)',
 apply:'«apply» — paquete/modelo aplica un perfil',reference:'«reference» — perfil referencia una metaclase',
 connector:'Conector entre partes/puertos — línea continua',delegation:'Delegación: puerto externo → puerto interno',
 'communication-path':'Comunicación entre nodos — línea continua',
 deployment:'Dependencia / Despliegue / Manifestación — «deploy» (artefacto → nodo)',
 manifestation:'Dependencia / Despliegue / Manifestación — «manifest» (artefacto → elemento)',
 'control-flow':'Flujo de control — línea continua con punta abierta',
 'object-flow':'Flujo de objeto — línea continua con punta abierta',
 transition:'Transición — evento [guarda] / efecto',
 trigger:'Disparador — etiqueta de evento sobre la transición',
 completion:'Transición de finalización — sin disparador explícito',
 message:'Mensaje síncrono — línea continua con punta rellena',
 reply:'Mensaje de retorno — línea discontinua con punta abierta',
 'async-message':'Mensaje asíncrono — línea continua con punta abierta',
 create:'Creación de participante — «create»',
 destroy:'Destrucción de participante — final en X'
}
export const umlRelationLabel=(kind:string)=>UML_RELATION_LABELS[kind]||kind.replaceAll('-', ' ')

/** Restringe extremos de las relaciones estrictas al metamodelo soportado.
 * Los modelos históricos conservan sus relaciones, pero no se crean otras nuevas inválidas.
 */
/** Validaciones semánticas para relaciones nuevas, no para migrar modelos históricos. */
export function umlRelationEndpointValid(diagram:DiagramType,kind:string,source:ElementType,target:ElementType):boolean{
 if(diagram==='uml-class')return classEndpointValid(kind,source,target)
 if(diagram==='uml-activity'){
  // UML: particiones encapsulan los nodos; no participan como origen/destino del flujo.
  const forbidden=['uml-partition']
  if(forbidden.includes(source)||forbidden.includes(target))return false
  if(['uml-end','uml-flow-final'].includes(source)||target==='uml-start')return false
  if(kind==='control-flow')return source!=='uml-object-node'&&target!=='uml-object-node'
  if(kind==='object-flow')return source==='uml-object-node'||target==='uml-object-node'
  return false
 }
 if(diagram==='uml-deployment'){
  const location=(t:ElementType)=>['uml-node','uml-device','uml-execution'].includes(t)
  if(kind==='communication-path')return location(source)&&location(target)
  if(kind==='deployment')return source==='uml-artifact'&&location(target)
 }
 if(diagram==='uml-package'){
  const pkg=(t:ElementType)=>['uml-package','uml-subpackage','uml-model','uml-profile'].includes(t)
  return pkg(source)&&pkg(target)
 }
 if(diagram==='uml-profile'){
  if(kind==='extension')return source==='uml-stereotype'&&target==='uml-metaclass'
  if(kind==='apply')return ['uml-package','uml-model'].includes(source)&&target==='uml-profile'
  if(kind==='reference')return source==='uml-profile'&&target==='uml-metaclass'
  if(kind==='generalization')return source==='uml-stereotype'&&target==='uml-stereotype'
  return false
 }
 if(diagram==='uml-usecase')return useCaseEndpointValid(kind,source,target)

 if(diagram==='uml-sequence'){
  const participant=(t:ElementType)=>['actor','uml-lifeline','uml-activation'].includes(t)
  if(kind==='create')return participant(source)&&target==='uml-lifeline'
  if(kind==='destroy')return participant(source)&&['uml-lifeline','uml-activation','uml-destruction'].includes(target)
  return participant(source)&&participant(target)&&['message','reply','async-message'].includes(kind)
 }
 if(diagram==='uml-communication'){
  const participant=(t:ElementType)=>['actor','uml-object','uml-lifeline'].includes(t)
  if(!participant(source)||!participant(target))return false
  return ['link','message','reply','async-message'].includes(kind)
 }
 if(diagram==='uml-state'){
  const stateLike=(t:ElementType)=>['uml-start','uml-state','uml-end','uml-region','uml-decision','uml-fork','uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point','uml-terminate'].includes(t)
  if(!stateLike(source)||!stateLike(target))return false
  if(target==='uml-start'||source==='uml-end'||source==='uml-terminate')return false
  if(kind==='generalization')return source==='uml-state'&&target==='uml-state'
  return ['transition','trigger','completion'].includes(kind)
 }
 if(diagram==='uml-composite'){
  const connectable=(t:ElementType)=>['uml-part','uml-reference-role','uml-port'].includes(t)
  if(kind==='connector'||kind==='assembly')return connectable(source)&&connectable(target)
  // Delegación histórica: sólo lectura, no se ofrece al crear.
  if(kind==='delegation')return connectable(source)&&connectable(target)
 }
 if(diagram==='uml-component'){
  const connector=(t:ElementType)=>['component','uml-port'].includes(t)
  if(kind==='assembly')return connector(source)&&connector(target)
  if(kind==='provided-interface'||kind==='required-interface')
   return connector(source)&&['uml-interface','uml-port'].includes(target)
  if(kind==='realization')return source==='component'&&target==='uml-interface'
 }
 return true
}

/** Feature availability only: existing views and imports remain readable. */
export const ACTIVE_UML_CREATION_TYPES:readonly DiagramType[]=['uml-class','uml-usecase','uml-activity','uml-sequence','uml-component','uml-deployment']
export const diagramCreationEnabled=(type:DiagramType)=>!type.startsWith('uml-')||ACTIVE_UML_CREATION_TYPES.includes(type)
export const DIAGRAM_CREATION_TYPES=UML_DIAGRAMS.filter(diagramCreationEnabled)
