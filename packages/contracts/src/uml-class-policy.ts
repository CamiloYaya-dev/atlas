import {deploymentEndpointValid} from './uml-deployment-catalog'
import {componentEndpointValid} from './uml-component-catalog'
/** NOVZI class-diagram policy. IDs refer to shared catalog elements, not labels. */
import type {Diagram,DiagramEdge,ElementType,ModelElement,ProjectDocument,UmlAssociationEnd} from './index'
import {validUmlDetail} from './uml-structure'
import {umlRelationNameLocked,validUmlEdgeNotation,umlRelationNotation} from './uml-notation'
import {CLASS_TYPES,ASSOCIATION_KINDS,isClassImport,classImportAliasAllowed} from './uml-class-catalog'
export {CLASS_TYPES,CLASS_RELATIONS,CLASS_FAMILIES,ASSOCIATION_KINDS,isClassImport,classImportAliasAllowed} from './uml-class-catalog'
export const isAssociation=(kind?:string)=>ASSOCIATION_KINDS.some(k=>k===kind)
export const isClassType=(t:ElementType)=>CLASS_TYPES.some(k=>k===t)
const group=(t:ElementType)=>t==='uml-association-class'?'uml-class':t==='uml-model'?'uml-package':t
const pkg=(t:ElementType)=>group(t)==='uml-package'
const auxiliary=(t:ElementType)=>t==='uml-comment'||t==='uml-constraint'
const classifier=(t:ElementType)=>isClassType(t)&&!pkg(t)&&!auxiliary(t)
/** A reference to a UML Type cannot point at a package, model or annotation. */
export const classTypeReferenceAllowed=(t:ElementType)=>classifier(t)
/** A constrained formal parameter accepts its declared type or a specialization. */
export function classTemplateArgumentAllowed(doc:ProjectDocument,formalTypeId:string|undefined,argumentId:string):boolean{
 const actual=doc.elements[argumentId];if(!actual||!classTypeReferenceAllowed(actual.type))return false
 if(!formalTypeId)return true
 const formal=doc.elements[formalTypeId];if(!formal||!classTypeReferenceAllowed(formal.type))return false
 if(argumentId===formalTypeId)return true
 const arcs=new Map<string,Set<string>>()
 for(const d of doc.diagrams.filter(d=>d.type==='uml-class'))for(const e of d.edges.filter(e=>e.relationKind==='generalization')){const a=d.nodes.find(n=>n.id===e.source)?.elementId,b=d.nodes.find(n=>n.id===e.target)?.elementId;if(a&&b&&doc.elements[a]&&doc.elements[b]&&classEndpointValid('generalization',doc.elements[a].type,doc.elements[b].type)){if(!arcs.has(a))arcs.set(a,new Set());arcs.get(a)!.add(b)}}
 return cyclic(formalTypeId,argumentId,arcs)
}
export function classCapabilities(t:ElementType){return {attributes:classifier(t)&&t!=='uml-primitive',operations:classifier(t)&&t!=='uml-signal',literals:t==='uml-enumeration',flags:classifier(t),abstract:['uml-class','uml-association-class','uml-datatype','uml-signal'].includes(t),template:classifier(t)&&t!=='uml-signal',note:auxiliary(t),package:pkg(t)}}
export function classEndpointValid(kind:string,source:ElementType,target:ElementType):boolean{
 const a=group(source),b=group(target)
 if(!isClassType(source)||!isClassType(target))return false
 if(kind==='annotation')return auxiliary(source)&&!auxiliary(target)
 if(auxiliary(source)||auxiliary(target))return false
 if(kind==='aggregation'||kind==='composition')return ['uml-class','uml-interface'].includes(a)&&['uml-class','uml-interface'].includes(b)
 if(isAssociation(kind))return classifier(source)&&classifier(target)
 if(kind==='generalization')return classifier(source)&&classifier(target)&&(a===b||['uml-enumeration','uml-primitive'].includes(a)&&b==='uml-datatype')
 if(kind==='realization')return a==='uml-class'&&b==='uml-interface'
 if(kind==='specification-realization')return true
 if(kind==='merge')return pkg(source)&&pkg(target)
 if(kind==='packageImport'||kind==='packageAccess')return pkg(target)
 if(kind==='elementImport'||kind==='elementAccess')return classifier(target)||pkg(target)
 if(kind==='containment')return pkg(source)||['uml-class','uml-interface'].includes(a)&&classifier(target)
 if(kind==='bind')return classifier(source)&&classifier(target)
 return ['dependency','usage','import','access','abstraction','trace','refine','derive'].includes(kind)
}
export const classSelfAllowed=(kind?:string)=>isAssociation(kind)
export function validMultiplicity(value:string|undefined):boolean{
 if(value===undefined||value==='')return true
 if(!/^(?:\*|\d+|\d+\.\.(?:\d+|\*))$/.test(value))return false
 const [a,b]=value.split('..');if(a==='*')return true
 return Number.isSafeInteger(Number(a))&&(b===undefined||b==='*'||Number.isSafeInteger(Number(b))&&Number(b)>=Number(a))
}
export function umlTypeIdentifier(e:ModelElement):string{
 if(e.type==='uml-class')return e.uml?.abstract?'«Abstract Class»':e.uml?.leaf?'«Final Class»':'«Class»'
 const labels:Partial<Record<ElementType,string>>={'uml-interface':'interface','uml-enumeration':'enumeration','uml-datatype':'dataType','uml-primitive':'primitive','uml-signal':'signal','uml-association-class':'Association Class','uml-comment':'Comment','uml-constraint':'Constraint','uml-package':'Package','uml-model':'model','uml-subpackage':'Subpackage'}
 return `«${labels[e.type]||e.type.replace(/^uml-/,'').split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ')}»`
}
export function classDetailErrors(e:ModelElement,doc:ProjectDocument):string[]{
 const u=e.uml||{},c=classCapabilities(e.type),errors:string[]=[]
 if(!validUmlDetail(e.uml))return ['Detalle UML inválido']
 if(!e.name.trim()&&!c.note)errors.push('Nombre requerido')
 if(!c.attributes&&u.attributes?.length)errors.push('Atributos no permitidos')
 if(!c.operations&&u.operations?.length)errors.push('Operaciones no permitidas')
 if(!c.literals&&u.literals?.length)errors.push('Literales no permitidos')
 if(!c.template&&u.templateParameters?.length)errors.push('Plantilla no permitida')
 // Explicit allowlist: a Class is not an InstanceSpecification or deployment node.
 const permitted=new Set([...(c.flags||c.package?['visibility']:[]),...(c.attributes?['attributes']:[]),...(c.operations?['operations']:[]),...(c.literals?['literals']:[]),...(c.template?['templateParameters']:[]),...(c.flags?['leaf']:[]),...(c.abstract?['abstract']:[]),...(e.type==='uml-comment'?['note']:[]),...(e.type==='uml-constraint'?['expression']:[])])
 for(const [key,value] of Object.entries(u))if(value!==undefined&&!permitted.has(key))errors.push(`Propiedad UML no permitida para ${e.type}: ${key}`)

 if(c.package&&u.visibility&&!['public','private'].includes(u.visibility))errors.push('Visibilidad de paquete inválida')
 if(u.leaf&&u.abstract)errors.push('Abstract y leaf incompatibles')
 const ids=new Set<string>(),names=new Set<string>(),signatures=new Set<string>()
 const allowedKeys=(member:object,keys:string[])=>{for(const [key,value] of Object.entries(member))if(value!==undefined&&!keys.includes(key))errors.push('Propiedad de miembro UML no permitida: '+key)}
 const entry=(id:string,name:string)=>{if(!id||!name.trim()||ids.has(id))errors.push('Miembro sin nombre o ID duplicado');ids.add(id)}
 const ref=(id?:string)=>{if(id===undefined)return;const target=doc.elements[id];if(!target)errors.push('Referencia de tipo inexistente');else if(!classTypeReferenceAllowed(target.type))errors.push('Referencia de tipo incompatible: '+target.type)}
 for(const a of u.attributes||[]){allowedKeys(a,['id','name','type','visibility','multiplicity','length','defaultValue','typeId','readOnly','derived','static','ordered','unique']);entry(a.id,a.name);if(names.has(a.name))errors.push('Atributo duplicado');names.add(a.name);if(!validMultiplicity(a.multiplicity))errors.push('Multiplicidad de atributo inválida');if(e.type==='uml-interface'&&a.visibility!=='public')errors.push('Interfaz: atributo público requerido');if(e.type==='uml-enumeration'&&!a.readOnly)errors.push('Enumeración: atributo de solo lectura requerido');ref(a.typeId)}
 for(const o of u.operations||[]){allowedKeys(o,['id','name','visibility','returnType','parameters','returnTypeId','abstract','static','query']);entry(o.id,o.name);if(o.abstract&&o.static)errors.push('Operación abstracta y estática incompatibles');if(o.parameters.filter(p=>p.direction==='return').length>1)errors.push('Solo se admite un parámetro de retorno');if(e.type==='uml-interface'&&o.visibility!=='public')errors.push('Interfaz: operación pública requerida');ref(o.returnTypeId);const sig=JSON.stringify([o.name,o.parameters.map(p=>[p.direction||'in',p.typeId||p.type])]);if(signatures.has(sig))errors.push('Firma de operación duplicada');signatures.add(sig);for(const p of o.parameters){allowedKeys(p,['id','name','type','typeId','direction','multiplicity','defaultValue']);entry(p.id,p.name);ref(p.typeId);if(!validMultiplicity(p.multiplicity))errors.push('Multiplicidad de parámetro inválida')}}
 const lits=new Set<string>();for(const l of u.literals||[]){allowedKeys(l,['id','name']);entry(l.id,l.name);if(lits.has(l.name.trim()))errors.push('Literal duplicado');lits.add(l.name.trim())}
 const formalNames=new Set<string>();for(const p of u.templateParameters||[]){allowedKeys(p,['id','name','typeId','constraint']);entry(p.id,p.name);ref(p.typeId);if(formalNames.has(p.name.trim()))errors.push('Parámetro formal duplicado');formalNames.add(p.name.trim())}
 if(e.type==='uml-constraint'&&!u.expression?.trim())errors.push('Expresión de restricción requerida')
 return errors
}
/** Semantic end values, with the old binary attributes as a compatibility fallback. */
export function classEndProperties(e:DiagramEdge,side:'source'|'target'):Omit<UmlAssociationEnd,'id'|'nodeId'>{
 const explicit=e.associationEnds?.[side==='source'?0:1]
 return {role:explicit?.role??e[`${side}Role`],multiplicity:explicit?.multiplicity??e[`${side}Multiplicity`],navigability:explicit?.navigability??e[`${side}Navigability`],ordered:explicit?.ordered??e[`${side}Ordered`],unique:explicit?.unique??e[`${side}Unique`],handle:explicit?.handle??e[`${side}Handle`]}
}
export function classEdgeErrors(doc:ProjectDocument,d:Diagram,e:DiagramEdge):string[]{
 const errors:string[]=[],s=d.nodes.find(n=>n.id===e.source),t=d.nodes.find(n=>n.id===e.target),a=s&&doc.elements[s.elementId],b=t&&doc.elements[t.elementId],k=e.relationKind||''
 if(!a||!b)return ['Extremos inexistentes']
 if(!validClassEdgeShape(e as unknown as Record<string,unknown>))return ['Propiedades de relación UML inválidas']
 const keys=new Set(['id','source','target','label','sourceHandle','targetHandle','direction','lineStyle','pathStyle','relationKind','sourceMultiplicity','targetMultiplicity','sourceRole','targetRole','description','wholeEnd','sourceNavigability','targetNavigability','importAlias','templateBindings','associationEnds','associationClassId','annotationTargetEdgeId','sourceOrdered','targetOrdered','sourceUnique','targetUnique'])
 for(const [key,value] of Object.entries(e))if(value!==undefined&&!keys.has(key))errors.push('Propiedad de relación UML no permitida: '+key)
 if(!validUmlEdgeNotation(d.type,e))errors.push('Notación UML incompatible')
 if(umlRelationNameLocked(d.type,k)&&e.label)errors.push('El nombre de la relación UML es reservado')
 if(!classEndpointValid(k,a.type,b.type))errors.push('Extremos incompatibles con la relación UML')
 if(a.id===b.id&&!classSelfAllowed(k))errors.push('Autorelación UML no permitida')
 if(isAssociation(k)){
  if(!validMultiplicity(e.sourceMultiplicity)||!validMultiplicity(e.targetMultiplicity))errors.push('Multiplicidad de asociación inválida')
  if(k==='composition'&&!['','1','0..1'].includes((e.wholeEnd==='target'?e.targetMultiplicity:e.sourceMultiplicity)||''))errors.push('Composición: multiplicidad del todo debe ser 1 o 0..1')
 }else if(e.sourceMultiplicity||e.targetMultiplicity||e.sourceRole||e.targetRole)errors.push('Roles y multiplicidades solo para asociaciones')
 if(!isAssociation(k)&&['sourceNavigability','targetNavigability','sourceOrdered','targetOrdered','sourceUnique','targetUnique','associationEnds','associationClassId'].some(key=>(e as unknown as Record<string,unknown>)[key]!==undefined))errors.push('Propiedades de extremos solo para asociaciones')
 if(k!=='bind'&&e.templateBindings!==undefined)errors.push('Sustituciones solo para binding de plantilla')
 if(k!=='annotation'&&e.annotationTargetEdgeId!==undefined)errors.push('Anclaje a relación solo para anotaciones')

 if(e.wholeEnd!==undefined&&(!['source','target'].includes(e.wholeEnd)||!['aggregation','composition'].includes(k)))errors.push('Extremo todo inválido')
 if([e.sourceNavigability,e.targetNavigability].some(v=>v!==undefined&&!['navigable','non-navigable','unspecified'].includes(v)))errors.push('Navegabilidad inválida')
 if(e.associationEnds){
  const ends=e.associationEnds
  if(k!=='association'||ends.length<3||new Set(ends.map(x=>x.id)).size!==ends.length||ends[0]?.nodeId!==e.source||ends[1]?.nodeId!==e.target)errors.push('Asociación n-aria: mínimo tres extremos propios y sin agregación')
  for(const [i,side] of ['source','target'].entries()){const n=ends[i],prefix=side as 'source'|'target';if(n){for(const key of ['role','multiplicity','navigability','ordered','unique','handle'] as const){const field=`${prefix}${key[0].toUpperCase()}${key.slice(1)}` as keyof DiagramEdge;if(n[key]!==undefined&&e[field]!==undefined&&n[key]!==e[field])errors.push('Extremo n-ario contradictorio: '+key)}}}
  for(const x of ends){if(Object.keys(x).some(key=>!['id','nodeId','role','multiplicity','navigability','ordered','unique','handle'].includes(key)))errors.push('Propiedad de extremo n-ario no permitida');const node=d.nodes.find(n=>n.id===x.nodeId),el=node&&doc.elements[node.elementId];if(!el||!classifier(el.type)||!validMultiplicity(x.multiplicity)||!x.id.trim()||x.handle!==undefined&&!['left','right','top-1','top-2','top-3','bottom-1','bottom-2','bottom-3'].includes(x.handle))errors.push('Extremo n-ario incompatible')}
 }
 if(e.associationClassId){const el=doc.elements[e.associationClassId];if(!isAssociation(k)||el?.type!=='uml-association-class'||!d.nodes.some(n=>n.elementId===el.id)||[a.id,b.id].includes(el.id)||e.associationEnds?.some(x=>d.nodes.find(n=>n.id===x.nodeId)?.elementId===el.id))errors.push('Clase de asociación inválida')}
 if(e.annotationTargetEdgeId){const target=d.edges.find(x=>x.id===e.annotationTargetEdgeId);if(k!=='annotation'||!target||target.id===e.id||target.relationKind==='annotation'||target.source!==e.target)errors.push('Anclaje de anotación inválido')}
 if(k==='generalization'&&b.uml?.leaf)errors.push('No se puede especializar un clasificador final')
 if(isClassImport(k)){
  if((k==='import'||k==='access')&&pkg(b.type)&&!e.importAlias?.trim())errors.push('Importación histórica ambigua: elige explícitamente elemento o miembros de paquete')
  if(b.semanticOwnerId===a.id)errors.push('Importación de miembro propio no permitida')
  const seen=new Set<string>();let member:ModelElement|undefined=b
  while(member&&!seen.has(member.id)){seen.add(member.id);if(member.uml?.visibility&&member.uml.visibility!=='public'){errors.push('Importación de miembro privado o no público (visibilidad efectiva) no permitida');break}member=member.semanticOwnerId?doc.elements[member.semanticOwnerId]:undefined}
 }
 if(k==='containment'&&b.semanticOwnerId!==a.id)errors.push('Contención requiere propietario semántico coincidente')
 if(e.importAlias!==undefined&&(!classImportAliasAllowed(k)||!e.importAlias.trim()))errors.push('Alias de importación inválido')
 if(k==='specification-realization'&&!e.description?.trim())errors.push('Realización genérica requiere contexto de especificación')
 if(k==='bind'){
  const ids=new Set(b.uml?.templateParameters?.map(p=>p.id)||[]),bindings=e.templateBindings||[]
  if(bindings.some(p=>Object.keys(p).some(key=>!['parameterId','elementId'].includes(key))))errors.push('Propiedad de sustitución de plantilla no permitida')
  if(!ids.size||bindings.length!==ids.size||new Set(bindings.map(p=>p.parameterId)).size!==ids.size||bindings.some(p=>!ids.has(p.parameterId)||!classTemplateArgumentAllowed(doc,b.uml?.templateParameters?.find(f=>f.id===p.parameterId)?.typeId,p.elementId)))errors.push('Sustituciones de plantilla inválidas o incompatibles')
 }
 return errors
}
const cyclic=(from:string,to:string,arcs:Map<string,Set<string>>):boolean=>{const seen=new Set<string>(),stack=[to];while(stack.length){const n=stack.pop()!;if(n===from)return true;if(seen.has(n))continue;seen.add(n);stack.push(...arcs.get(n)||[])}return false}
export type ClassIssue={key:string;message:string;fingerprint?:string}
/** NOVZI strict policy: a colliding unqualified imported name must be resolved explicitly.
 * Direct ElementImport takes precedence in lookup, but a shadowed different member is
 * reported rather than silently accepting the ambiguous model. Only public imports
 * participate in the finite re-export closure. No labels or diagram-local IDs define identity.
 */
export function classImportResolution(doc:ProjectDocument,includeComponents=false):{issues:ClassIssue[];members:{namespaceId:string;name:string;memberId?:string;preferredMemberId?:string;ambiguous:boolean}[]}{
 type Entry={source:string;target:string;name:string;kind:'element'|'package';public:boolean;key:string}
 type Candidate={id:string;name:string;key:string;priority:number}
 const imports:Entry[]=[],locals=new Map<string,Candidate[]>(),visible=new Map<string,Map<string,Candidate>>()
 const effectivePublic=(id:string)=>{const seen=new Set<string>();let e:ModelElement|undefined=doc.elements[id];while(e){if(seen.has(e.id)||e.uml?.visibility&&e.uml.visibility!=='public')return false;seen.add(e.id);e=e.semanticOwnerId?doc.elements[e.semanticOwnerId]:undefined}return true}
 const push=(owner:string,c:Candidate)=>{let m=visible.get(owner);if(!m)visible.set(owner,m=new Map());const token=JSON.stringify([c.id,c.name]);if(m.has(token))return false;m.set(token,c);return true}
 for(const e of Object.values(doc.elements)){if(!e.semanticOwnerId||(!isClassType(e.type)&&!(includeComponents&&['component','uml-artifact'].includes(e.type)))||auxiliary(e.type))continue;const c={id:e.id,name:e.name.trim(),key:'',priority:2};const list=locals.get(e.semanticOwnerId)||[];list.push(c);locals.set(e.semanticOwnerId,list);if(effectivePublic(e.id))push(e.semanticOwnerId,c)}
 for(const d of doc.diagrams.filter(x=>x.type==='uml-class'))for(const e of d.edges){const k=e.relationKind||'';if(!isClassImport(k))continue;const source=d.nodes.find(n=>n.id===e.source)?.elementId,target=d.nodes.find(n=>n.id===e.target)?.elementId;if(!source||!target||!doc.elements[source]||!doc.elements[target]||source===target||doc.elements[target].semanticOwnerId===source||!effectivePublic(target)||!classEndpointValid(k,doc.elements[source].type,doc.elements[target].type))continue;
  // Ambiguous legacy package destinations are diagnosed separately; for read-only
  // analysis retain their previous package-import interpretation, never mutate them.
  const kind=k==='packageImport'||k==='packageAccess'||(k==='import'||k==='access')&&pkg(doc.elements[target].type)&&!e.importAlias?'package':'element';const entry:Entry={source,target,kind,public:!['access','elementAccess','packageAccess'].includes(k),name:(kind==='element'?e.importAlias?.trim():undefined)||doc.elements[target].name.trim(),key:`edge:${d.id}:${e.id}`};imports.push(entry);if(kind==='element'&&entry.public)push(source,{id:target,name:entry.name,key:entry.key,priority:1})
 }
 if(includeComponents)for(const r of Object.values(doc.componentRelations||{})){const k=r.kind,source=r.sourceElementId,target=r.targetElementId;if(!isClassImport(k)||!doc.elements[source]||!doc.elements[target]||source===target||doc.elements[target].semanticOwnerId===source||!effectivePublic(target)||!componentEndpointValid(k,doc.elements[source].type,doc.elements[target].type))continue;const kind=k==='packageImport'||k==='packageAccess'||(k==='import'||k==='access')&&pkg(doc.elements[target].type)&&!r.importAlias?'package':'element';const entry:Entry={source,target,kind,public:!['access','elementAccess','packageAccess'].includes(k),name:(kind==='element'?r.importAlias?.trim():undefined)||doc.elements[target].name.trim(),key:`record:${r.id}`};imports.push(entry);if(kind==='element'&&entry.public)push(source,{id:target,name:entry.name,key:entry.key,priority:1})}
 // A work queue visits each (namespace, member ID, imported name) at most once.
 // Local and explicit element names are statically known, including private imports.
 // A package import cannot re-export a member shadowed by a higher-precedence name.
 const preferred=new Map<string,Set<string>>();const prefer=(ns:string,name:string,id:string)=>{const key=JSON.stringify([ns,name]);const set=preferred.get(key)||new Set<string>();set.add(id);preferred.set(key,set)};for(const [ns,list] of locals)for(const c of list)prefer(ns,c.name,c.id);for(const i of imports)if(i.kind==='element')prefer(i.source,i.name,i.target)
 const consumers=new Map<string,Entry[]>();for(const i of imports)if(i.kind==='package'&&i.public){const list=consumers.get(i.target)||[];list.push(i);consumers.set(i.target,list)}
 const queue:[string,Candidate][]=[];for(const [ns,entries] of visible)for(const c of entries.values())queue.push([ns,c]);for(let i=0;i<queue.length;i++){const [ns,c]=queue[i];for(const imp of consumers.get(ns)||[]){if(c.id===imp.source||doc.elements[c.id]?.semanticOwnerId===imp.source||preferred.has(JSON.stringify([imp.source,c.name])))continue;const candidate={...c,key:imp.key,priority:0};if(push(imp.source,candidate))queue.push([imp.source,candidate])}}
 const names=new Map<string,Candidate[]>();for(const i of imports){const candidates=i.kind==='element'?[{id:i.target,name:i.name,key:i.key,priority:1}]:Array.from(visible.get(i.target)?.values()||[],c=>({...c,key:i.key,priority:0}));for(const c of candidates){if(c.id===i.source||doc.elements[c.id]?.semanticOwnerId===i.source)continue;const key=JSON.stringify([i.source,c.name]),list=names.get(key)||[];list.push(c);names.set(key,list)}}
 const issues:ClassIssue[]=[],members:{namespaceId:string;name:string;memberId?:string;preferredMemberId?:string;ambiguous:boolean}[]=[];for(const [ns,list] of locals)for(const c of list){const key=JSON.stringify([ns,c.name]);if(!names.has(key))names.set(key,[])}
 for(const [key,entries] of names){const [owner,name]=JSON.parse(key) as [string,string];const local=(locals.get(owner)||[]).filter(c=>c.name===name);const all=[...local,...entries].sort((a,b)=>b.priority-a.priority),ids=new Set(all.map(c=>c.id)),top=new Set(all.filter(c=>c.priority===all[0].priority).map(c=>c.id));const ambiguous=ids.size>1;const preferredMemberId=top.size===1?[...top][0]:undefined;members.push({namespaceId:owner,name,memberId:ambiguous?undefined:preferredMemberId,...(ambiguous?{preferredMemberId}:{}),ambiguous});if(!ambiguous)continue;const fingerprint=JSON.stringify([owner,name,[...ids].sort()]);for(const edgeKey of new Set(entries.map(c=>c.key)))issues.push({key:edgeKey,message:'Nombre o alias de importación ambiguo; usa un alias distinto o nombre calificado (ElementImport tiene precedencia)',fingerprint})}
 return {issues,members}
}
export function classDocumentIssues(doc:ProjectDocument):ClassIssue[]{
 const issues:ClassIssue[]=[],add=(key:string,errors:string[])=>errors.forEach(message=>issues.push({key,message})),general=new Map<string,Set<string>>(),ownership=new Map<string,Set<string>>()
 const classIds=new Set(doc.diagrams.filter(d=>d.type==='uml-class').flatMap(d=>d.nodes.map(n=>n.elementId)))
 // Standalone class-only catalog types must also validate before first reuse.
 for(const e of Object.values(doc.elements))if(['uml-class','uml-interface','uml-enumeration','uml-datatype','uml-primitive','uml-association-class','uml-comment'].includes(e.type))classIds.add(e.id)
 const associationIdentity=new Map<string,{signature:string;key:string}[]>()
 const signature=(d:Diagram,e:DiagramEdge)=>{
  const id=(nodeId:string)=>d.nodes.find(n=>n.id===nodeId)?.elementId
  const end=(nodeId:string,role?:string,multiplicity?:string,navigability?:string,ordered?:boolean,unique?:boolean,whole=false)=>JSON.stringify([id(nodeId),role||'',multiplicity||'',navigability||'unspecified',!!ordered,unique!==false,whole])
  const whole=['aggregation','composition'].includes(e.relationKind||'')?(e.wholeEnd||'source'):undefined
  const n=umlRelationNotation(e.relationKind||'association'),a=classEndProperties(e,'source'),b=classEndProperties(e,'target');const ends=[end(e.source,a.role,a.multiplicity,a.navigability||(n.start==='open-arrow'?'navigable':'unspecified'),a.ordered,a.unique,whole==='source'),end(e.target,b.role,b.multiplicity,b.navigability||(n.end==='open-arrow'?'navigable':'unspecified'),b.ordered,b.unique,whole==='target'),...(e.associationEnds||[]).slice(2).map(x=>end(x.nodeId,x.role,x.multiplicity,x.navigability,x.ordered,x.unique))]
  return JSON.stringify([e.relationKind,e.label||'',e.description||'',ends.sort()])
 }

 for(const e of Object.values(doc.elements)){
  if(classIds.has(e.id))add(`element:${e.id}`,classDetailErrors(e,doc))
  if(e.semanticOwnerId){const parent=doc.elements[e.semanticOwnerId];if(!parent||!classEndpointValid('containment',parent.type,e.type)&&!((e.uml?.component||e.type==='component'||e.type==='uml-artifact')&&componentEndpointValid('containment',parent.type,e.type))&&!(e.uml?.deployment&&deploymentEndpointValid('containment',parent.type,e.type)))add(`owner:${e.id}`,['Propietario incompatible']);ownership.set(e.id,new Set([e.semanticOwnerId]))}
 }
 for(const [id,parents] of ownership)for(const parent of parents)if(cyclic(id,parent,ownership))add(`owner:${id}`,['Ciclo de propiedad'])
 for(const d of doc.diagrams.filter(d=>d.type==='uml-class'))for(const e of d.edges){
  add(`edge:${d.id}:${e.id}`,classEdgeErrors(doc,d,e));if(e.relationKind==='generalization'){const a=d.nodes.find(n=>n.id===e.source)?.elementId,b=d.nodes.find(n=>n.id===e.target)?.elementId;if(a&&b){if(!general.has(a))general.set(a,new Set());general.get(a)!.add(b)}}
 }
 for(const d of doc.diagrams.filter(d=>d.type==='uml-class')){
  const seen=new Set<string>();for(const e of d.edges)if(e.associationClassId){const id=e.associationClassId;if(seen.has(id))add(`edge:${d.id}:${e.id}`,['Clase de asociación duplicada']);seen.add(id);const appearances=associationIdentity.get(id)||[];appearances.push({signature:signature(d,e),key:`edge:${d.id}:${e.id}`});associationIdentity.set(id,appearances);for(const n of [e.source,e.target,...e.associationEnds?.map(x=>x.nodeId)||[]]){const el=d.nodes.find(x=>x.id===n)?.elementId;if(el&&(cyclic(id,el,general)||cyclic(el,id,general)))add(`edge:${d.id}:${e.id}`,['Clase de asociación relacionada con sus supertipos'])}}
 }
 // Resolve imports once across the shared catalog, including cross-view occurrences.
 issues.push(...classImportResolution(doc).issues)
 for(const appearances of associationIdentity.values())if(new Set(appearances.map(x=>x.signature)).size>1)for(const a of appearances)add(a.key,['Clase de asociación con identidad semántica diferente entre vistas'])
 for(const [id,parents] of general)for(const p of parents)if(cyclic(id,p,general))add(`general:${id}:${p}`,['Ciclo de generalización'])
 return issues
}
/** Edit one semantic association and all its visible occurrences in one immutable document.
 * Occurrence IDs, coordinates, local paths and other view-local layout stay local.
 * Missing or ambiguous occurrences are refused, never created implicitly.
 */
export function replaceClassRelationAcrossViews(doc:ProjectDocument,diagramId:string,next:DiagramEdge):ProjectDocument{
 const view=doc.diagrams.find(d=>d.id===diagramId&&d.type==='uml-class')
 if(!view)throw Error('Diagrama UML no disponible')
 const previous=view.edges.find(e=>e.id===next.id),shared=previous?.associationClassId
 const elementId=(d:Diagram,nodeId:string)=>d.nodes.find(n=>n.id===nodeId)?.elementId
 return {...doc,diagrams:doc.diagrams.map(d=>{
  if(d.type!=='uml-class')return d
  if(d.id!==diagramId&&(!shared||!d.edges.some(e=>e.associationClassId===shared)))return d
  const edges=d.edges.map(e=>{
   if(d.id===diagramId&&e.id===next.id)return next
   if(!shared||e.associationClassId!==shared)return e
   // An explicit unlink changes the association-class relationship in every occurrence.
   if(!next.associationClassId)return {...e,associationClassId:undefined}
   if(!d.nodes.some(n=>n.elementId===next.associationClassId))throw Error('No se puede sincronizar la asociación en todas sus apariciones')
   const resolve=(nodeId:string,preferred:string[])=>{const id=elementId(view,nodeId);const known=preferred.find(n=>elementId(d,n)===id);if(known)return known;const found=d.nodes.filter(n=>n.elementId===id);if(!id||found.length!==1)throw Error('No se puede sincronizar la asociación en todas sus apariciones');return found[0].id}
   const source=resolve(next.source,[e.source,e.target]),target=resolve(next.target,[e.target,e.source])
   // Do not transplant the edited view's port IDs or path geometry into another occurrence.
   const handle=(id:string,side:'source'|'target')=>id===e[side]?e[`${side}Handle`]:id===e[side==='source'?'target':'source']?e[`${side==='source'?'target':'source'}Handle`]:undefined
   const used=new Set<string>();const ends=next.associationEnds?.map((end,i)=>{const nodeId=i===0?source:i===1?target:resolve(end.nodeId,e.associationEnds?.filter(x=>!used.has(x.id)).map(x=>x.nodeId)||[]);const old=e.associationEnds?.find(x=>x.nodeId===nodeId&&!used.has(x.id));if(old)used.add(old.id);return {...end,id:old?.id||end.id,nodeId,handle:i===0?handle(source,'source'):i===1?handle(target,'target'):old?.handle}})
   return {...e,label:next.label,description:next.description,relationKind:next.relationKind,direction:next.direction,lineStyle:next.lineStyle,source,target,sourceHandle:handle(source,'source'),targetHandle:handle(target,'target'),sourceRole:next.sourceRole,targetRole:next.targetRole,sourceMultiplicity:next.sourceMultiplicity,targetMultiplicity:next.targetMultiplicity,sourceNavigability:next.sourceNavigability,targetNavigability:next.targetNavigability,sourceOrdered:next.sourceOrdered,targetOrdered:next.targetOrdered,sourceUnique:next.sourceUnique,targetUnique:next.targetUnique,wholeEnd:next.wholeEnd,associationClassId:next.associationClassId,associationEnds:ends}
  })
  if(d.id===diagramId&&!previous)edges.push(next)
  return {...d,edges:edges.map(e=>{const anchored=e.annotationTargetEdgeId&&edges.find(x=>x.id===e.annotationTargetEdgeId);const before=anchored&&d.edges.find(x=>x.id===anchored.id);return anchored&&before&&before.source!==anchored.source&&e.target!==anchored.source?{...e,target:anchored.source,targetHandle:undefined}:e})}
 })}
}

/** Allow unchanged historical issues to be read; changed invalid objects are never rewritten silently. */
export function newClassIssues(before:ProjectDocument,after:ProjectDocument):ClassIssue[]{
 const old=new Set(classDocumentIssues(before).map(x=>JSON.stringify(x)))
 return classDocumentIssues(after).filter(i=>!old.has(JSON.stringify(i))||(()=>{const [kind,a,b]=i.key.split(':');if(kind==='element'||kind==='owner'){const semantic=(e:ModelElement|undefined)=>e&&[e.type,e.name,e.uml,e.semanticOwnerId];return JSON.stringify(semantic(before.elements[a]))!==JSON.stringify(semantic(after.elements[a]))};if(kind==='edge')return JSON.stringify(before.diagrams.find(d=>d.id===a)?.edges.find(e=>e.id===b))!==JSON.stringify(after.diagrams.find(d=>d.id===a)?.edges.find(e=>e.id===b));return false})())
}

/** View-only diagnostics, not a mutation of the historical snapshot. */
export function classDesignWarnings(doc:ProjectDocument,d:Diagram):string[]{
 const warnings:string[]=[],dependency=new Map<string,Set<string>>(),composition=new Map<string,Set<string>>()
 const element=(id:string)=>d.nodes.find(n=>n.id===id)?.elementId
 for(const n of d.nodes){const e=doc.elements[n.elementId];if(e?.type==='uml-association-class'&&!doc.diagrams.some(v=>v.type==='uml-class'&&v.edges.some(edge=>isAssociation(edge.relationKind)&&edge.associationClassId===e.id)))warnings.push(`Clase de asociación sin asociación vinculada: ${e.name}`)}
 for(const e of d.edges){const a=element(e.source),b=element(e.target);if(!a||!b)continue;const map=e.relationKind==='composition'?composition:['dependency','usage'].includes(e.relationKind||'')?dependency:null;if(map){const [from,to]=map===composition&&e.wholeEnd==='target'?[b,a]:[a,b];if(!map.has(from))map.set(from,new Set());map.get(from)!.add(to)}}
 for(const [id,targets] of dependency)for(const target of targets)if(cyclic(id,target,dependency))warnings.push('Dependencia circular: revisar diseño')
 for(const [id,targets] of composition)for(const target of targets)if(cyclic(id,target,composition))warnings.push('Composición de tipos recursiva: evitar ciclos entre instancias')
 const inherited=(id:string,seen=new Set<string>()):{attributes:string[];operations:string[]}=>{if(seen.has(id))return {attributes:[],operations:[]};seen.add(id);const e=doc.elements[id],attributes=(e?.uml?.attributes||[]).map(x=>`${x.name}:${x.typeId||x.type}`),operations=(e?.uml?.operations||[]).map(x=>JSON.stringify([x.name,x.parameters.map(p=>p.typeId||p.type),x.returnTypeId||x.returnType]));for(const view of doc.diagrams.filter(v=>v.type==='uml-class'))for(const edge of view.edges.filter(x=>x.relationKind==='generalization'&&view.nodes.find(n=>n.id===x.source)?.elementId===id)){const parent=view.nodes.find(n=>n.id===edge.target)?.elementId;if(parent){const found=inherited(parent,seen);attributes.push(...found.attributes);operations.push(...found.operations)}}return {attributes,operations}}
 for(const e of d.edges.filter(e=>e.relationKind==='realization')){const a=element(e.source),b=element(e.target);if(!a||!b)continue;const impl=inherited(a),contract=inherited(b);if(contract.attributes.some(x=>!impl.attributes.includes(x))||contract.operations.some(x=>!impl.operations.includes(x)))warnings.push('Realización con requisitos de contrato pendientes')}
 return [...new Set(warnings)]
}
/** Editable adapter only: never mutate historical snapshots or infer enum literals. */
export function adaptClassDocument(doc:ProjectDocument):ProjectDocument{
 const copy=structuredClone(doc)
 // Keep unknown legacy fields untouched; reserved labels are preserved in description.
 const fixed:Record<string,string>={import:'«import»',packageImport:'«import»',elementImport:'«import»',elementAccess:'«access»',packageAccess:'«access»',usage:'«use»',access:'«access»',merge:'«merge»',include:'«include»',extend:'«extend»',apply:'«apply»',deployment:'«deploy»',manifestation:'«manifest»',bind:'«bind»',abstraction:'«abstraction»',trace:'«trace»',refine:'«refine»',derive:'«derive»'}
 for(const d of copy.diagrams.filter(d=>d.type.startsWith('uml-')))for(const e of d.edges){const label=fixed[e.relationKind||''];if(label&&e.label){if(e.label!==label)e.description=[e.description,e.label].filter(Boolean).join('\n');delete e.label}}
 return copy
}

export function validClassEdgeShape(a:Record<string,unknown>):boolean{
 const text=(v:unknown)=>typeof v==='string'&&v.length<=10000
 const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
 for(const k of ['description','importAlias','annotationTargetEdgeId','associationClassId'])if(a[k]!==undefined&&!text(a[k]))return false
 for(const k of ['sourceOrdered','targetOrdered','sourceUnique','targetUnique'])if(a[k]!==undefined&&typeof a[k]!=='boolean')return false
 if(a.wholeEnd!==undefined&&!['source','target'].includes(String(a.wholeEnd)))return false
 for(const k of ['sourceNavigability','targetNavigability'])if(a[k]!==undefined&&!['navigable','non-navigable','unspecified'].includes(String(a[k])))return false
 if(a.templateBindings!==undefined&&(!Array.isArray(a.templateBindings)||a.templateBindings.length>100||!a.templateBindings.every(v=>obj(v)&&text(v.parameterId)&&text(v.elementId))))return false
 if(a.associationEnds!==undefined&&(!Array.isArray(a.associationEnds)||a.associationEnds.length>100||!a.associationEnds.every(v=>obj(v)&&text(v.id)&&text(v.nodeId)&&['role','multiplicity','handle'].every(k=>v[k]===undefined||text(v[k]))&&(v.navigability===undefined||['navigable','non-navigable','unspecified'].includes(String(v.navigability)))&&['ordered','unique'].every(k=>v[k]===undefined||typeof v[k]==='boolean'))))return false
 return true
}
