import {activityActionSize,activityPinSize,activitySnapPin} from './uml-activity-layout'
import type {Diagram,DiagramEdge,ElementType,ModelElement,ProjectDocument} from './index'
export const ACTIVITY_TYPES=['uml-start','uml-action','uml-decision','uml-fork','uml-end','uml-flow-final','uml-object-node','uml-partition','uml-activity-pin','uml-activity-parameter','uml-activity-interruptible-region','uml-comment','uml-constraint'] as const satisfies readonly ElementType[]
export const ACTIVITY_RELATIONS=['control-flow','object-flow','exception-handler','annotation'] as const
export const ACTIVITY_ACTIONS=['generic','opaque','callBehavior','callOperation','sendSignal','acceptEvent','timeEvent'] as const
export type ActivityParameter={id:string;name:string;direction:'in'|'out'|'inout'|'return';typeId?:string;externalType?:string;lower?:number;upper?:number|'*';stream?:boolean;exception?:boolean;isControlType?:boolean;ordered?:boolean;unique?:boolean}
export interface ActivityRoot {parameters?:ActivityParameter[];precondition?:string;postcondition?:string;isSingleExecution?:boolean;showFrame?:boolean;readOnlyBehavior?:boolean}
export interface ActivityDetail { role?:'decision'|'merge'|'mergeDecision'|'fork'|'join'|'joinFork'|'input'|'output'|'value';kind?:typeof ACTIVITY_ACTIONS[number]|'object'|'centralBuffer'|'dataStore';orientation?:'horizontal'|'vertical';ownerActionId?:string;typeId?:string;externalType?:string;lower?:number;upper?:number|'*';upperBound?:number|'*';value?:string;isControl?:boolean;isControlType?:boolean;ordered?:boolean;unique?:boolean;inState?:string[];ordering?:'unordered'|'ordered'|'FIFO'|'LIFO';selection?:string;selectionBehaviorId?:string;referenceId?:string;operationId?:string;callDiagramId?:string;externalReference?:string;precondition?:string;postcondition?:string;parameterId?:string;argumentParameterId?:string;partitionIds?:string[];regionIds?:string[];isExternal?:boolean;isDimension?:boolean;represents?:string;joinSpec?:string;isCombineDuplicate?:boolean;decisionInput?:string;decisionInputBehaviorId?:string;decisionInputFlowId?:string;exceptionInput?:boolean }
export interface ActivityEdgeDetail {guard?:string;weight?:number|'*'|string;transformation?:string;transformationBehaviorId?:string;selection?:string;selectionBehaviorId?:string;multicast?:boolean;multireceive?:boolean;interruptingRegionId?:string;exceptionTypeIds?:string[]}
const fields:Partial<Record<ElementType,readonly string[]>>={
 'uml-action':['kind','referenceId','operationId','callDiagramId','externalReference','precondition','postcondition'],
 'uml-decision':['role','decisionInput','decisionInputBehaviorId','decisionInputFlowId'], 'uml-fork':['role','orientation','joinSpec','isCombineDuplicate'],
 'uml-object-node':['kind','typeId','externalType','upperBound','inState','ordering','selection','selectionBehaviorId','isControlType'],
 'uml-activity-pin':['role','ownerActionId','typeId','externalType','lower','upper','value','isControl','isControlType','ordered','unique','exceptionInput','argumentParameterId'],
 'uml-activity-parameter':['role','parameterId'], 'uml-partition':['orientation','isExternal','isDimension','represents'], 'uml-activity-interruptible-region':[], 'uml-start':[], 'uml-end':[], 'uml-flow-final':[], 'uml-comment':[], 'uml-constraint':[]
}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const text=(x:unknown)=>typeof x==='string'&&x.length<=10000
const id=(x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=256
const natural=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0
const limit=(x:unknown)=>x==='*'||natural(x)
const ids=(x:unknown)=>Array.isArray(x)&&x.length<=500&&x.every(id)&&new Set(x).size===x.length
const one=(x:unknown,values:readonly string[])=>typeof x==='string'&&values.includes(x)
const bool=(x:unknown)=>typeof x==='boolean'
const known=(x:Record<string,unknown>,rules:Record<string,(v:unknown)=>boolean>)=>Object.entries(x).every(([k,v])=>Object.hasOwn(rules,k)&& (v===undefined||rules[k](v)))
const detailRules:Record<string,(v:unknown)=>boolean>={role:v=>one(v,['decision','merge','mergeDecision','fork','join','joinFork','input','output','value']),kind:v=>one(v,[...ACTIVITY_ACTIONS,'object','centralBuffer','dataStore']),orientation:v=>one(v,['horizontal','vertical']),ownerActionId:id,typeId:id,externalType:text,lower:natural,upper:limit,upperBound:limit,value:text,isControl:bool,isControlType:bool,ordered:bool,unique:bool,inState:ids,ordering:v=>one(v,['unordered','ordered','FIFO','LIFO']),selection:text,selectionBehaviorId:id,referenceId:id,operationId:id,callDiagramId:id,externalReference:text,precondition:text,postcondition:text,parameterId:id,argumentParameterId:id,partitionIds:ids,regionIds:ids,isExternal:bool,isDimension:bool,represents:id,joinSpec:text,isCombineDuplicate:bool,decisionInput:text,decisionInputBehaviorId:id,decisionInputFlowId:id,exceptionInput:bool}
export const validActivityDetail=(x:unknown)=>x===undefined||obj(x)&&known(x,detailRules)
export const validActivityEdgeDetail=(x:unknown)=>x===undefined||obj(x)&&known(x,{guard:text,weight:v=>typeof v==='number'?Number.isSafeInteger(v)&&v>0:typeof v==='string'&&v.trim().length>0&&v.length<=10000&&!/^[-+]?\d+(\.\d+)?$/.test(v),transformation:text,transformationBehaviorId:id,selection:text,selectionBehaviorId:id,multicast:bool,multireceive:bool,interruptingRegionId:id,exceptionTypeIds:ids})
export const validActivityRoot=(x:unknown)=>x===undefined||obj(x)&&known(x,{precondition:text,postcondition:text,isSingleExecution:bool,showFrame:bool,readOnlyBehavior:bool,parameters:v=>Array.isArray(v)&&v.length<=500&&v.every(p=>obj(p)&&id(p.id)&&id(p.name)&&one(p.direction,['in','out','inout','return'])&&known(p,{id,name:id,direction:v=>one(v,['in','out','inout','return']),typeId:id,externalType:text,lower:natural,upper:limit,stream:bool,exception:bool,isControlType:bool,ordered:bool,unique:bool}))&&new Set(v.map(p=>p.id)).size===v.length&&new Set(v.map(p=>p.name)).size===v.length})
export function activityDefaults(type:ElementType):ActivityDetail {switch(type){case 'uml-start':case 'uml-end':case 'uml-flow-final':return {};case 'uml-decision':return {role:'decision'};case 'uml-fork':return {role:'fork',orientation:'horizontal'};case 'uml-action':return {kind:'generic'};case 'uml-object-node':return {kind:'object',upperBound:'*',ordering:'unordered'};case 'uml-activity-pin':return {role:'input',lower:1,upper:1};case 'uml-activity-parameter':return {role:'input'};case 'uml-partition':return {orientation:'vertical'};default:return {}}}
const control=(t:ElementType)=>['uml-decision','uml-fork'].includes(t)
const object=(t:ElementType)=>['uml-object-node','uml-activity-pin','uml-activity-parameter'].includes(t)
const final=(t:ElementType)=>['uml-end','uml-flow-final'].includes(t)
const note=(t:ElementType)=>['uml-comment','uml-constraint'].includes(t)
const flow=(e:DiagramEdge)=>['control-flow','object-flow'].includes(e.relationKind||'')
const objectFlow=(e:DiagramEdge)=>e.relationKind==='object-flow'
const classified=(t:ElementType)=>['uml-class','uml-interface','uml-enumeration','uml-datatype','uml-primitive','uml-association-class','uml-signal','component'].includes(t)
export function activityEndpointTypeValid(kind:string,a:ElementType,b:ElementType){
 if(kind==='annotation')return note(a)&&!note(b)&&ACTIVITY_TYPES.includes(b as typeof ACTIVITY_TYPES[number]);
 if(kind==='exception-handler')return a==='uml-action'&&b==='uml-activity-pin';
 if(final(a)||b==='uml-start'||!ACTIVITY_TYPES.includes(a as typeof ACTIVITY_TYPES[number])||!ACTIVITY_TYPES.includes(b as typeof ACTIVITY_TYPES[number]))return false
 if(kind==='control-flow')return (a==='uml-start'||a==='uml-action'||control(a)||object(a))&&(b==='uml-action'||control(b)||object(b)||final(b))
 if(kind==='object-flow')return (control(a)||object(a))&&(control(b)||object(b)||final(b))
 return false
}
export function activityEndpointValid(kind:string,a:ModelElement,b:ModelElement){
 if(!activityEndpointTypeValid(kind,a.type,b.type))return false
 const x=a.activityDetail||{},y=b.activityDetail||{}
 if(kind==='annotation')return a.id!==b.id
 if(kind==='exception-handler')return y.role==='input'&&y.exceptionInput===true&&a.id!==y.ownerActionId
 if(a.type==='uml-activity-pin'&&x.role!=='output'||a.type==='uml-activity-parameter'&&x.role!=='input'||b.type==='uml-activity-pin'&&y.role!=='input'||b.type==='uml-activity-parameter'&&y.role!=='output')return false
 return kind!=='control-flow'||(!object(a.type)||x.isControlType===true)&&(!object(b.type)||y.isControlType===true)
}
export function activityEffectiveElement(d:Diagram,el:ModelElement):ModelElement{return el.type==='uml-activity-parameter'?{...el,activityDetail:{...el.activityDetail,isControlType:d.activity?.parameters?.find(p=>p.id===el.activityDetail?.parameterId)?.isControlType}}:el}
export function activityRelationKinds(a:ModelElement,b:ModelElement,d?:Diagram):string[]{return ACTIVITY_RELATIONS.filter(k=>activityEndpointValid(k,d?activityEffectiveElement(d,a):a,d?activityEffectiveElement(d,b):b))}
export function activityNodeLabel(e:ModelElement){const d=e.activityDetail;return e.type==='uml-decision'?({decision:'Decision',merge:'Merge',mergeDecision:'Merge / Decision'}[d?.role as 'decision']||'Decision / Merge'):e.type==='uml-fork'?({fork:'Fork',join:'Join',joinFork:'Join / Fork'}[d?.role as 'fork']||'Fork / Join'):e.type==='uml-action'?({generic:'Action',opaque:'Opaque Action',callBehavior:'Call Behavior',callOperation:'Call Operation',sendSignal:'Send Signal',acceptEvent:'Accept Event',timeEvent:'Time Event'}[d?.kind as 'generic']||'Action'):e.type==='uml-object-node'?d?.kind==='dataStore'?'datastore':d?.kind==='centralBuffer'?'centralBuffer':'Object Node':({'uml-start':'Initial','uml-end':'Activity Final','uml-flow-final':'Flow Final','uml-activity-pin':d?.role==='output'?'Output Pin':d?.role==='value'?'Value Pin':'Input Pin','uml-activity-parameter':'Activity Parameter','uml-partition':'Partition','uml-activity-interruptible-region':'Interruptible Region','uml-comment':'Comment','uml-constraint':'Constraint'} as Record<string,string>)[e.type]||e.type}
export function activityEdgeLabel(d:Diagram,e:DiagramEdge,doc:ProjectDocument){const a=e.activityEdge||{}, target=doc.elements[d.nodes.find(n=>n.id===e.target)?.elementId||''];return [target?.activityDetail?.decisionInputFlowId===e.id?'«decisionInputFlow»':'',e.label,e.relationKind==='exception-handler'?(a.exceptionTypeIds||[]).map(id=>doc.elements[id]?.name).filter(Boolean).join(', '):'',a.guard?`[${a.guard.replace(/^\[|\]$/g,'')}]`:'',a.weight!==undefined&&a.weight!==1?`{weight=${a.weight}}`:'',a.transformation||a.transformationBehaviorId?`«transformation» ${a.transformation||doc.diagrams.find(v=>v.id===a.transformationBehaviorId)?.name||''}`:'',a.selection||a.selectionBehaviorId?`«selection» ${a.selection||doc.diagrams.find(v=>v.id===a.selectionBehaviorId)?.name||''}`:'',a.multicast?'«multicast»':'',a.multireceive?'«multireceive»':''].filter(Boolean).join(' · ')}
export interface ActivityIssue{key:string;message:string;diagramId:string;nodeId?:string;edgeId?:string;severity:'error'|'warning'}
export function activityDocumentIssues(doc:ProjectDocument):ActivityIssue[]{
 const issues:ActivityIssue[]=[], owners=new Map<string,string>();
 for(const d of doc.diagrams.filter(d=>d.type==='uml-activity')){
 const nodes=new Map(d.nodes.map(n=>[n.id,n])), element=(n:string)=>doc.elements[nodes.get(n)?.elementId||''], byElement=new Map(d.nodes.map(n=>[n.elementId,n]));
 const emitted=new Set<string>();
 const emit=(key:string,message:string,nodeId?:string,edgeId?:string,severity:'error'|'warning'='error')=>{const id=`${d.id}:${key}:${nodeId||''}:${edgeId||''}`;const fingerprint=JSON.stringify([id,message,severity]);if(!emitted.has(fingerprint)){emitted.add(fingerprint);issues.push({key:id,message,diagramId:d.id,nodeId,edgeId,severity})}};
 const conforms=(from:string,to:string)=>{const seen=new Set<string>(),stack=[from];while(stack.length){const v=stack.pop()!;if(v===to)return true;if(seen.has(v))continue;seen.add(v);for(const view of doc.diagrams.filter(v=>v.type==='uml-class'))for(const edge of view.edges.filter(e=>e.relationKind==='generalization'))if(view.nodes.find(n=>n.id===edge.source)?.elementId===v){const parent=view.nodes.find(n=>n.id===edge.target)?.elementId;if(parent)stack.push(parent)}}return false}
 const typeValid=(v:string|undefined)=>!v||!!doc.elements[v]&&classified(doc.elements[v].type)
 const pins=(owner:string)=>d.nodes.map(n=>element(n.id)).filter(e=>e?.type==='uml-activity-pin'&&e.activityDetail?.ownerActionId===owner);
 const bounds=(lo:number|undefined,hi:number|'*'|undefined)=>hi===undefined||hi==='*'||(lo??0)<=hi
 const validType=(a:{typeId?:string;externalType?:string})=>typeValid(a.typeId)&&!(a.typeId&&a.externalType)
 const paramAppearances=new Set<string>();
 const typed=(e:ModelElement)=>e.type==='uml-activity-parameter'?d.activity?.parameters?.find(p=>p.id===e.activityDetail?.parameterId)||{}:e.activityDetail||{}
 type ValueType={typeId?:string;externalType?:string;upper?:number|'*';upperBound?:number|'*'}
 const compatible=(source:ValueType,target:ValueType)=>source.typeId&&target.typeId?conforms(source.typeId,target.typeId):undefined;
 const checkType=(source:ValueType,target:ValueType,key:string,nodeId?:string,edgeId?:string)=>{const result=compatible(source,target);if(result===false)emit(key,'Tipos de comportamiento incompatibles',nodeId,edgeId);else if(result===undefined)emit(key,'Tipo de comportamiento no verificable',nodeId,edgeId,'warning')};
 const signature=(ref:string|undefined,external:string|undefined,kind:'decision'|'selection'|'transformation',nodeId?:string,edgeId?:string,expectedInputs:number|null=1)=>{
  if(ref&&external?.trim())emit(`${kind}-choice`,'Elegir comportamiento modelado o expresión externa',nodeId,edgeId);
  if(!ref){if(external?.trim())emit(`${kind}-unverified`,'Firma de comportamiento externo no verificable',nodeId,edgeId,'warning');return undefined}
  const callee=doc.diagrams.find(v=>v.id===ref&&v.type==='uml-activity');if(!callee){emit(`${kind}-reference`,'Comportamiento modelado inexistente o incompatible',nodeId,edgeId);return undefined}
  const ps=callee.activity?.parameters||[],ins=ps.filter(p=>p.direction==='in'),outs=ps.filter(p=>p.direction==='out'||p.direction==='return');
  if(callee.activity?.readOnlyBehavior!==true)emit(`${kind}-effects`,'Comportamiento requiere declaración sin efectos laterales',nodeId,edgeId,'warning');
  const valid=ps.length===ins.length+outs.length&&(kind==='decision'?(expectedInputs===null||ins.length===expectedInputs)&&outs.length===1&&outs[0].direction==='return':ins.length===1&&outs.length===1&&outs[0].direction==='out'&&(kind!=='selection'||ins[0].lower===0&&ins[0].upper==='*'&&ins[0].ordered===false&&ins[0].unique===false&&outs[0].upper!=='*'&&(outs[0].upper??1)<=1));
  if(!valid){emit(`${kind}-signature`,'Firma de comportamiento incompatible con '+kind,nodeId,edgeId);return undefined}return {ins,outs};
 };
 // A single forward traversal supplies effective types to both normal targets and decision inputs.
 // Each origin maintains its own finite visited states, retaining the largest weight encountered.
 const valuesByEdge=new Map<string,Map<string,ValueType>>();
 const transforms=new Map<string,ReturnType<typeof signature>>();
 for(const edge of d.edges.filter(objectFlow))if(edge.activityEdge?.transformation||edge.activityEdge?.transformationBehaviorId)transforms.set(edge.id,signature(edge.activityEdge.transformationBehaviorId,edge.activityEdge.transformation,'transformation',undefined,edge.id));
 for(const n of d.nodes){const src=element(n.id);if(!src||!object(src.type))continue;const seen=new Map<string,number>(),stack=d.edges.filter(e=>e.source===n.id&&objectFlow(e)).map(edge=>({edge,value:typed(src) as ValueType,weight:0}));while(stack.length){const {edge:e,value:input,weight:prior}=stack.pop()!;const weight=Math.max(prior,typeof e.activityEdge?.weight==='number'?e.activityEdge.weight:0),key=JSON.stringify([e.id,input.typeId,input.externalType,input.upperBound,input.upper]);if((seen.get(key)??-1)>=weight)continue;seen.set(key,weight);const dest=element(e.target);if(!dest)continue;let value=input;
 if(transforms.has(e.id)){const sig=transforms.get(e.id);if(sig){checkType(input,sig.ins[0],`transformation-input:${n.id}`,undefined,e.id);value=sig.outs[0]}else value={}}
 const arrivals=valuesByEdge.get(e.id)||new Map<string,ValueType>();arrivals.set(JSON.stringify([n.id,value.typeId,value.externalType,value.upperBound,value.upper]),value);valuesByEdge.set(e.id,arrivals);
 // Auxiliary decision inputs are consumed by the behavior, never forwarded as normal tokens.
 if(dest.activityDetail?.decisionInputFlowId===e.id)continue;
 if(control(dest.type)){stack.push(...d.edges.filter(q=>q.source===e.target&&objectFlow(q)).map(edge=>({edge,value,weight})));continue}
 if(!object(dest.type))continue;const target=typed(dest),result=compatible(value,target);if(result===false)emit(`conformance:${n.id}`,'Tipos de flujo de objeto incompatibles',undefined,e.id);else if(result===undefined)emit(`external:${n.id}`,'Conformidad de tipo externo no verificada',undefined,e.id,'warning');const upperA=value.upperBound??value.upper,upperB='upperBound'in target?target.upperBound:target.upper;if(upperA!==undefined&&upperB!==undefined&&upperA!==upperB)emit(`capacity:${n.id}`,'Upper bounds de objeto incompatibles',undefined,e.id);if(typeof upperB==='number'&&upperB<weight)emit('weight-capacity','Peso supera capacidad de destino',undefined,e.id)
 }}


 if(!validActivityRoot(d.activity))emit('root','Detalle de actividad inválido')
 for(const p of d.activity?.parameters||[])if(!validType(p)||!bounds(p.lower,p.upper))emit(`parameter:${p.id}`,'Tipo o multiplicidad de parámetro inválido')
 for(const n of d.nodes){const e=element(n.id);if(!e)continue;const a=e.activityDetail||{};const old=owners.get(e.id);if(old&&old!==d.id)emit('scope','Nodo semántico compartido entre actividades; utilizar llamada o copia local',n.id);owners.set(e.id,d.id);if(e.activityCatalogDiagramId&&e.activityCatalogDiagramId!==d.id)emit('catalog-scope','La ficha local pertenece a otra actividad; copia con nueva identidad',n.id);if(d.nodes.some(other=>other.id!==n.id&&other.elementId===e.id))emit('occurrence','Una actividad admite una aparición por nodo semántico',n.id)
  if(!validActivityDetail(a)||Object.keys(a).some(k=>!['partitionIds','regionIds',...(fields[e.type]||[])].includes(k)))emit('fields','Propiedades incompatibles con el nodo de actividad',n.id)
  if(e.uml&&(e.uml.attributes?.length||e.uml.operations?.length||e.uml.slots?.length||e.uml.literals?.length))emit('members','Un nodo de actividad no admite miembros de clase',n.id)
  if(!validType(a)||!bounds(a.lower,a.upper))emit('type','Tipo o multiplicidad de nodo inválido',n.id)
  if(e.type==='uml-action'){
   if(!e.name.trim()||a.kind&&!ACTIVITY_ACTIONS.includes(a.kind as typeof ACTIVITY_ACTIONS[number]))emit('action','Acción sin nombre o variante inválida',n.id)
   if(a.kind==='sendSignal'&&!(a.referenceId&&doc.elements[a.referenceId]?.type==='uml-signal'||a.externalReference?.trim()))emit('signal','Enviar señal requiere una señal o referencia externa',n.id)
   if(a.kind==='callBehavior'&&!(a.callDiagramId&&doc.diagrams.some(v=>v.id===a.callDiagramId&&v.type==='uml-activity')||a.externalReference?.trim()))emit('call','Llamada requiere una actividad o comportamiento externo',n.id)
   if(a.kind==='callOperation'&&!(a.referenceId&&doc.elements[a.referenceId]?.uml?.operations?.some(o=>o.id===a.operationId)||a.externalReference?.trim()))emit('operation','Operación invocada inválida',n.id)
   if(a.kind==='acceptEvent'&&!(a.referenceId?['uml-signal','event'].includes(doc.elements[a.referenceId]?.type):a.externalReference?.trim())||a.kind==='timeEvent'&&!a.externalReference?.trim())emit('event','Evento requiere señal/evento válido o expresión temporal externa',n.id)
   if(a.externalReference?.trim()&&(a.referenceId||a.operationId||a.callDiagramId))emit('reference-choice','Elegir referencia modelada o expresión externa, no ambas',n.id)
   if(a.externalReference&& !['opaque','sendSignal','acceptEvent','timeEvent','callBehavior','callOperation'].includes(a.kind||''))emit('external-fields','Expresión externa incompatible con variante',n.id)
   if(a.kind==='sendSignal'&&a.referenceId&&doc.elements[a.referenceId]?.type!=='uml-signal'||a.kind==='callBehavior'&&a.callDiagramId&&!doc.diagrams.some(v=>v.id===a.callDiagramId&&v.type==='uml-activity')||a.kind==='callOperation'&&a.referenceId&&!doc.elements[a.referenceId]?.uml?.operations?.some(o=>o.id===a.operationId))emit('invalid-reference','Referencia modelada incompatible con variante',n.id)
   if(['callBehavior','callOperation'].includes(a.kind||'')){
    const signature=activityCallParameters(doc,e);const actual=pins(e.id).filter(p=>!p.activityDetail?.exceptionInput);
    if(!signature){if(a.externalReference?.trim())emit('call-external','Firma de llamada externa no verificable',n.id,undefined,'warning')}else{
     const seen=new Set<string>();for(const p of actual){const pd=p.activityDetail!,param=signature.find(v=>v.id===pd.argumentParameterId),side=pd.role==='output'?'output':'input',pair=`${pd.argumentParameterId}:${side}`;if(!pd.argumentParameterId){emit(`call-unbound:${p.id}`,'Pin sin parámetro de llamada seleccionado',byElement.get(p.id)?.id,undefined,'warning');continue}if(!param||!activityParameterRoles(param).includes(side)||seen.has(pair)){emit(`call-pin:${p.id}`,'Pin no corresponde a parámetro/dirección de llamada o está duplicado',byElement.get(p.id)?.id);continue}seen.add(pair);const from=side==='input'?pd:param,to=side==='input'?param:pd;if(from.typeId&&to.typeId&&!conforms(from.typeId,to.typeId)||from.externalType&&to.externalType&&from.externalType!==to.externalType||(pd.lower??1)!==(param.lower??1)||(pd.upper??1)!==(param.upper??1))emit(`call-type:${p.id}`,'Tipo o multiplicidad de pin incompatible con firma de llamada',byElement.get(p.id)?.id);else if(!from.typeId||!to.typeId){if(!from.externalType||!to.externalType)emit(`call-type-unknown:${p.id}`,'Conformidad de tipo de llamada no verificable',byElement.get(p.id)?.id,undefined,'warning')}}
     for(const param of signature)for(const side of activityParameterRoles(param))if(!seen.has(`${param.id}:${side}`))emit(`call-missing:${param.id}:${side}`,`Falta pin ${side} para ${param.name}`,n.id,undefined,'warning')
    }
   }
   if(a.kind&&!['sendSignal','callOperation','acceptEvent'].includes(a.kind)&&a.referenceId||a.operationId&&a.kind!=='callOperation'||a.callDiagramId&&a.kind!=='callBehavior')emit('action-fields','Referencia incompatible con variante de acción',n.id)
   if(a.referenceId&&!doc.elements[a.referenceId])emit('reference','Referencia de acción inexistente',n.id)
  }
  if(e.type==='uml-object-node'&&(a.kind&&!['object','centralBuffer','dataStore'].includes(a.kind)||(a.selection||a.selectionBehaviorId)&&a.ordering!=='ordered'))emit('object','Variante u orden de objeto inválido',n.id)
  if(e.type==='uml-object-node'&&(a.selection||a.selectionBehaviorId)){const sig=signature(a.selectionBehaviorId,a.selection,'selection',n.id);if(sig){checkType(a,sig.ins[0],'selection-input',n.id);checkType(sig.outs[0],a,'selection-output',n.id)}}
  if(e.type==='uml-activity-pin'){
   if(!['input','output','value'].includes(a.role||'')||!a.ownerActionId||doc.elements[a.ownerActionId]?.type!=='uml-action'||!byElement.has(a.ownerActionId))emit('pin','Pin requiere acción propietaria y dirección',n.id)
   if(a.ownerActionId){const parent=byElement.get(a.ownerActionId),owner=doc.elements[a.ownerActionId];if(parent&&owner&&n.parentNodeId===parent.id){const snapped=activitySnapPin(activityActionSize(parent),activityPinSize(n),a.role,n.y);if(Math.abs(n.x-snapped.x)>0.01||Math.abs(n.y-snapped.y)>0.01)emit('pin-layout','Pin debe estar adherido al borde de su acción',n.id)}else emit('pin-layout','Pin debe estar adherido a su acción',n.id)}
   if(a.argumentParameterId&&!['callBehavior','callOperation'].includes(doc.elements[a.ownerActionId||'']?.activityDetail?.kind||''))emit('pin-argument','Solo una llamada admite vincular argumentos',n.id)
   if(a.role==='value'&&!a.value?.trim()||a.role!=='value'&&a.value!==undefined||a.exceptionInput&&a.role!=='input')emit('value','Propiedades incompatibles con la dirección del pin',n.id)
  }
  if(e.type==='uml-activity-parameter'){if(n.parentNodeId)emit('param-layout','Parámetro pertenece al borde de la actividad, no a un contenedor',n.id);const p=d.activity?.parameters?.find(p=>p.id===a.parameterId);if(!p||!['input','output'].includes(a.role||'')||a.role==='input'&&p.direction!=='in'&&p.direction!=='inout'||a.role==='output'&&!['out','return','inout'].includes(p.direction))emit('param-node','Parámetro de actividad o dirección inválidos',n.id);else{const key=`${a.parameterId}:${a.role}`;if(paramAppearances.has(key))emit('param-duplicate','Parámetro de actividad repetido en la misma dirección',n.id);paramAppearances.add(key)}}
  if(a.represents&&!doc.elements[a.represents])emit('represents','Responsabilidad referenciada inexistente',n.id)
  for(const [list,kind] of [[a.partitionIds,'uml-partition'],[a.regionIds,'uml-activity-interruptible-region']] as const)for(const ref of list||[])if(ref===e.id||!byElement.has(ref)||doc.elements[ref]?.type!==kind)emit(`membership:${ref}`,'Pertenencia fuera de la actividad o inválida',n.id)
  if(e.type==='uml-partition'){const seen=new Set<string>(),todo=[...a.partitionIds||[]];while(todo.length){const id=todo.pop()!;if(id===e.id){emit('partition-cycle','Ciclo de particiones',n.id);break}if(seen.has(id))continue;seen.add(id);todo.push(...doc.elements[id]?.activityDetail?.partitionIds||[])}}
  const incoming=d.edges.filter(x=>x.target===n.id&&flow(x)),out=d.edges.filter(x=>x.source===n.id&&flow(x));
  const role=a.role||inferActivityRole(e.type,incoming.length,out.length)
  if(e.type==='uml-decision'&&a.role&&!['decision','merge','mergeDecision'].includes(a.role)||e.type==='uml-fork'&&a.role&&!['fork','join','joinFork'].includes(a.role))emit('role','Rol de control incompatible',n.id)
  if(e.type==='uml-decision'||e.type==='uml-fork'){
   if(!role)emit('ambiguous','Rol histórico ambiguo: elegir explícitamente antes de editar',n.id,undefined,'warning')
   const aux=incoming.find(x=>x.id===a.decisionInputFlowId),primary=incoming.filter(x=>x.id!==a.decisionInputFlowId),same=(arr:DiagramEdge[])=>new Set(arr.map(x=>x.relationKind)).size<=1
   if(a.decisionInputFlowId&&(!aux||!objectFlow(aux)||!['decision','mergeDecision'].includes(role||'')))emit('aux','Flujo auxiliar debe ser un flujo de objeto entrante de decisión',n.id)
   if(a.decisionInput||a.decisionInputBehaviorId){const primaryObjects=primary.filter(objectFlow),groups=[...(primaryObjects.length?[primaryObjects]:[]),...(aux?[[aux]]:[])];const sig=signature(a.decisionInputBehaviorId,a.decisionInput,'decision',n.id,undefined,primary.length?groups.length:null);if(sig&&primary.length)groups.forEach((edges,i)=>edges.forEach(edge=>{const values=valuesByEdge.get(edge.id);if(!values?.size)emit('decision-source','No se pudo determinar el tipo entrante de decisión',n.id,edge.id,'warning');else for(const value of values.values())checkType(value,sig.ins[i],'decision-type',n.id,edge.id)})) }

   if(role==='merge'&&(a.decisionInput||a.decisionInputBehaviorId||a.decisionInputFlowId))emit('merge-fields','Fusión no admite entrada de decisión',n.id)
   if(role==='fork'&&(a.joinSpec!==undefined||a.isCombineDuplicate!==undefined))emit('fork-fields','Fork no admite joinSpec',n.id)
   if((role==='decision'&&primary.length>1)||(role==='fork'&&incoming.length>1)||(role==='merge'||role==='join')&&out.length>1)emit('degree','Grado máximo del nodo de control excedido',n.id)
   if(['decision','mergeDecision','merge','fork'].includes(role||'')&&!same([...primary,...out]))emit('flow-type','Tipos de flujo incompatibles en el control',n.id)
   if(['join','joinFork'].includes(role||'')&&incoming.length&&out.some(x=>objectFlow(x)!==(role==='joinFork'?activityCombinedControl(doc,d,n.id)?.internalEdge.relationKind==='object-flow':incoming.some(objectFlow))))emit('join-type','Salida de join debe ser de objeto si alguna entrada es de objeto',n.id)
   if(!incoming.length||!out.length||['decision','mergeDecision'].includes(role||'')&&!primary.length||['fork','joinFork','decision','mergeDecision'].includes(role||'')&&out.length<2||['join','merge','joinFork','mergeDecision'].includes(role||'')&&primary.length<2)emit('incomplete','Nodo de control incompleto',n.id,undefined,'warning')
   if(out.filter(x=>x.activityEdge?.guard?.trim().replace(/^\[|\]$/g,'')==='else').length>1)emit('else-count','Solo una salida else por decisión',n.id)
  }
  if((e.type==='uml-start'&&!out.length)||(final(e.type)&&!incoming.length))emit('incomplete','Inicio/final sin flujo',n.id,undefined,'warning')
 }
 for(const p of d.activity?.parameters||[])for(const side of activityParameterRoles(p))if(!paramAppearances.has(`${p.id}:${side}`))emit(`param-missing:${p.id}:${side}`,`Falta nodo de parámetro ${p.name} (${side})`,undefined,undefined,'warning')
 for(const edge of d.edges){const a=element(edge.source),b=element(edge.target),k=edge.relationKind||'',x=edge.activityEdge||{};if(!a||!b)continue
  if(!ACTIVITY_RELATIONS.includes(k as typeof ACTIVITY_RELATIONS[number])){emit('legacy','Relación histórica requiere revisión',undefined,edge.id,'warning');continue}
  const effective=(el:ModelElement)=>el.type==='uml-activity-parameter'?{...el,activityDetail:{...el.activityDetail,isControlType:d.activity?.parameters?.find(p=>p.id===el.activityDetail?.parameterId)?.isControlType}}:el
  if(!activityEndpointValid(k,effective(a),effective(b)))emit('endpoint','Extremos incompatibles con el flujo de actividad',undefined,edge.id)
  if(Object.keys(edge).some(key=>!['id','source','target','label','description','sourceHandle','targetHandle','direction','lineStyle','pathStyle','relationKind','activityEdge','annotationTargetEdgeId'].includes(key)&&edge[key as keyof DiagramEdge]!==undefined&&edge[key as keyof DiagramEdge]!==''))emit('unknown-edge','Propiedad no permitida de arista de actividad',undefined,edge.id)
  if(!validActivityEdgeDetail(x)||Object.keys(x).some(key=>!(k==='annotation'?[]:k==='exception-handler'?['exceptionTypeIds']:['guard','weight','interruptingRegionId',...(k==='object-flow'?['transformation','transformationBehaviorId','selection','selectionBehaviorId','multicast','multireceive']:[])]).includes(key)))emit('edge-fields','Propiedades incompatibles con el flujo',undefined,edge.id)
  if(['sourceRole','targetRole','sourceMultiplicity','targetMultiplicity','sourceNavigability','targetNavigability','wholeEnd','associationEnds','associationClassId','semanticRelationId','templateBindings','extensionPointIds','extensionCondition','importAlias','sourceOrdered','targetOrdered','sourceUnique','targetUnique','dependencyContext','showExtensionNote'].some(key=>edge[key as keyof DiagramEdge]!==undefined&&edge[key as keyof DiagramEdge]!==''))emit('foreign','Propiedad de otra familia UML en actividad',undefined,edge.id)
  for(const [el,handle] of [[a,edge.sourceHandle],[b,edge.targetHandle]] as const)if(handle&&['uml-start','uml-end','uml-flow-final','uml-decision','uml-activity-pin'].includes(el.type)&&!['left','right','top-2','bottom-2'].includes(handle))emit('handle','El nodo exige anclaje cardinal',undefined,edge.id)
  if(flow(edge)&&(edge.direction&&edge.direction!=='forward'||edge.lineStyle&&edge.lineStyle!=='solid'))emit('notation','Dirección o trazo de flujo inválido',undefined,edge.id)
  if(x.guard?.trim().replace(/^\[|\]$/g,'')==='else'&&!(a.type==='uml-decision'&&['decision','mergeDecision'].includes(a.activityDetail?.role||inferActivityRole(a.type,d.edges.filter(i=>i.target===edge.source&&flow(i)).length,d.edges.filter(i=>i.source===edge.source&&flow(i)).length)||'')))emit('else','else solo se permite en decisión',undefined,edge.id)
  if(x.multicast&&x.multireceive||(x.selection||x.selectionBehaviorId)&&!object(a.type))emit('object-flags','Selección o distribución de objeto incompatible',undefined,edge.id)
  if(k==='object-flow'&&(x.selection||x.selectionBehaviorId)){const sig=signature(x.selectionBehaviorId,x.selection,'selection',undefined,edge.id);if(sig&&object(a.type)){checkType(typed(a),sig.ins[0],'selection-input',undefined,edge.id);checkType(sig.outs[0],typed(a),'selection-output',undefined,edge.id)}}
  if(x.interruptingRegionId){const region=x.interruptingRegionId;if(doc.elements[region]?.type!=='uml-activity-interruptible-region'||!byElement.has(region)||!a.activityDetail?.regionIds?.includes(region)||b.activityDetail?.regionIds?.includes(region))emit('interrupt','Flujo interruptor debe salir de su región',undefined,edge.id)}
  if(edge.annotationTargetEdgeId&&k!=='annotation')emit('annotation-fields','Solo una anotación puede anclarse a una arista',undefined,edge.id)
  if(k==='annotation'&&edge.annotationTargetEdgeId){const target=d.edges.find(x=>x.id===edge.annotationTargetEdgeId);if(!target||target.relationKind==='annotation'||edge.target!==target.source)emit('annotation','Anclaje de anotación inválido',undefined,edge.id)}
  if(k==='exception-handler'){const body=b.activityDetail?.ownerActionId;const bodyNode=body&&byElement.get(body);if(!bodyNode||d.edges.some(x=>flow(x)&&(x.source===bodyNode.id||x.target===bodyNode.id))||!x.exceptionTypeIds?.length||x.exceptionTypeIds.some(t=>!typeValid(t)))emit('exception','Handler o tipos de excepción inválidos',undefined,edge.id);const input=b.activityDetail;if(input?.typeId&&x.exceptionTypeIds?.some(t=>!conforms(t,input.typeId!)))emit('exception-type','Tipo de excepción incompatible con el pin receptor',undefined,edge.id);if(body){const outputs=(owner:string)=>pins(owner).filter(p=>p.activityDetail?.role==='output').map(p=>p.activityDetail!);const expected=outputs(a.id),actual=outputs(body);if(expected.length!==actual.length||expected.some((p,i)=>{const q=actual[i];return !q||p.typeId!==q.typeId||p.externalType!==q.externalType||(p.lower??1)!==(q.lower??1)||(p.upper??1)!==(q.upper??1)}))emit('exception-outputs','Salidas de handler incompatibles con la acción protegida',undefined,edge.id)}}
 }

 }
 return issues
}
/** Two semantic control nodes and their internal ActivityEdge, represented by one visual occurrence.
 * IDs are deterministic tuples scoped to the Activity. A copied Activity gets different IDs.
 * No persisted duplicate state can drift from the role or from the external edges. */
export function activityCombinedControl(doc:ProjectDocument,d:Diagram,nodeId:string){
 const n=d.nodes.find(n=>n.id===nodeId),e=n&&doc.elements[n.elementId],role=e?.activityDetail?.role;if(!n||!e||!['mergeDecision','joinFork'].includes(role||''))return undefined;
 const first=role==='mergeDecision'?'merge':'join',second=role==='mergeDecision'?'decision':'fork',make=(phase:string)=>JSON.stringify([d.id,e.id,phase]),incoming=d.edges.filter(x=>flow(x)&&x.target===nodeId),outgoing=d.edges.filter(x=>flow(x)&&x.source===nodeId),aux=e.activityDetail?.decisionInputFlowId,primary=incoming.filter(x=>x.id!==aux),kind=role==='joinFork'?primary.some(objectFlow)?'object-flow':'control-flow':primary[0]?.relationKind||outgoing[0]?.relationKind||'control-flow';
 return {nodes:[{id:make(first),role:first},{id:make(second),role:second}],internalEdge:{id:make('internal'),source:make(first),target:make(second),relationKind:kind},incoming:incoming.map(x=>({edgeId:x.id,target:make(x.id===aux?second:first)})),outgoing:outgoing.map(x=>({edgeId:x.id,source:make(second)}))};
}
export function activityParameterRoles(p:ActivityParameter):('input'|'output')[]{return p.direction==='inout'?['input','output']:p.direction==='in'?['input']:['output']}
/** A modeled operation uses its parameter IDs; an implicit return has a stable synthetic ID. */
export function activityCallParameters(doc:ProjectDocument,e:ModelElement):ActivityParameter[]|undefined{
 const a=e.activityDetail;if(a?.kind==='callBehavior'&&a.callDiagramId){const target=doc.diagrams.find(d=>d.id===a.callDiagramId&&d.type==='uml-activity');return target?target.activity?.parameters||[]:undefined}
 if(a?.kind==='callOperation'&&a.referenceId){const op=doc.elements[a.referenceId]?.uml?.operations?.find(o=>o.id===a.operationId);if(!op)return undefined;const result:ActivityParameter[]=op.parameters.map(p=>{const v=p.multiplicity?.split('..');const lo=v?.[0]==='*'?0:Number(v?.[0]||1),hi=v?.at(-1)==='*'?'*':Number(v?.at(-1)||1);return {id:p.id,name:p.name,direction:p.direction||'in',typeId:p.typeId,externalType:p.typeId?undefined:p.type,lower:lo,upper:hi}});if((op.returnTypeId||op.returnType&&op.returnType.toLowerCase()!=='void')&&!result.some(p=>p.direction==='return'))result.push({id:`${op.id}:return`,name:'return',direction:'return',typeId:op.returnTypeId,externalType:op.returnTypeId?undefined:op.returnType,lower:1,upper:1});return result}
 return undefined
}
export function inferActivityRole(t:ElementType,ins:number,outs:number):ActivityDetail['role']|undefined{if(t==='uml-decision'){if(ins===1&&outs>1)return 'decision';if(ins>1&&outs===1)return 'merge'}if(t==='uml-fork'){if(ins===1&&outs>1)return 'fork';if(ins>1&&outs===1)return 'join'}return undefined}
export function newActivityIssues(before:ProjectDocument,after:ProjectDocument){
 const fingerprint=(doc:ProjectDocument,i:ActivityIssue)=>{const d=doc.diagrams.find(x=>x.id===i.diagramId);if(!d)return '';const semantic=(id:string)=>{const n=d.nodes.find(n=>n.id===id),e=n&&doc.elements[n.elementId];return e?{type:e.type,detail:e.activityDetail,uml:e.uml}:null};const edge=(e:DiagramEdge)=>{const {pathStyle,...rest}=e;return rest};if(i.edgeId){const e=d.edges.find(x=>x.id===i.edgeId);return JSON.stringify(e&&[edge(e),semantic(e.source),semantic(e.target)])}if(i.nodeId)return JSON.stringify([semantic(i.nodeId),...(i.key.includes(':pin-layout:')?[d.nodes.find(n=>n.id===i.nodeId),d.nodes.find(n=>n.id===d.nodes.find(n=>n.id===i.nodeId)?.parentNodeId)]:[]),d.edges.filter(e=>e.source===i.nodeId||e.target===i.nodeId).map(edge)]);return JSON.stringify(d.activity)}
 const old=activityDocumentIssues(before).filter(i=>i.severity==='error');return activityDocumentIssues(after).filter(i=>i.severity==='error'&&!old.some(p=>p.key===i.key&&p.message===i.message&&fingerprint(before,p)===fingerprint(after,i)))
}
export function activityReferences(a:ActivityDetail|undefined){return a?[a.typeId,a.referenceId,a.ownerActionId,a.represents,...a.partitionIds||[],...a.regionIds||[]].filter((x):x is string=>!!x):[]}
/** Resolve only unambiguous historical roles; never modify the incoming snapshot. */
export function adaptActivityDocument(doc:ProjectDocument):ProjectDocument{
 let elements=doc.elements
 for(const d of doc.diagrams.filter(d=>d.type==='uml-activity'))for(const n of d.nodes){const e=elements[n.elementId];if(!e||e.activityDetail?.role||!['uml-decision','uml-fork'].includes(e.type))continue;const role=inferActivityRole(e.type,d.edges.filter(x=>flow(x)&&x.target===n.id).length,d.edges.filter(x=>flow(x)&&x.source===n.id).length);if(role){if(elements===doc.elements)elements={...elements};elements[e.id]={...e,activityDetail:{...e.activityDetail,role}}}}
 return elements===doc.elements?doc:{...doc,elements}
}

/** Preserve only the provenance of actual former local appearances, never infer it from a name or type. */
export function retainActivityCatalog(before:ProjectDocument,after:ProjectDocument):ProjectDocument{
 const elements={...after.elements};let changed=false;
 for(const d of before.diagrams.filter(d=>d.type==='uml-activity'))for(const n of d.nodes){const e=elements[n.elementId];if(!e||e.activityCatalogDiagramId||!ACTIVITY_TYPES.includes(e.type as typeof ACTIVITY_TYPES[number])||after.diagrams.find(v=>v.id===d.id)?.nodes.some(v=>v.elementId===n.elementId))continue;elements[e.id]={...e,activityCatalogDiagramId:d.id};changed=true}
 return changed?{...after,elements}:after
}
export function activityCatalogReferenced(doc:ProjectDocument,id:string):boolean{
 return doc.diagrams.some(d=>d.nodes.some(n=>n.elementId===id)||d.activity?.parameters?.some(p=>p.typeId===id)||d.edges.some(e=>e.activityEdge?.interruptingRegionId===id||e.activityEdge?.exceptionTypeIds?.includes(id)))||Object.values(doc.elements).some(e=>e.id!==id&&activityReferences(e.activityDetail).includes(id))
}
