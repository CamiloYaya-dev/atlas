import {validDeploymentDetail} from './uml-deployment-policy'
import type {DeploymentDetail} from './uml-deployment-policy'
import {validComponentDetail} from './uml-component-policy'
import type {ComponentDetail} from './uml-component-policy'
/** UML structural detail is attached to the shared element; semantic ownership is stored on the shared element; visual nesting belongs to an occurrence. */
export type UmlVisibility='public'|'private'|'protected'|'package'
export interface UmlAttribute {id:string;name:string;type:string;visibility:UmlVisibility;multiplicity?:string;length?:number;defaultValue?:string;typeId?:string;readOnly?:boolean;derived?:boolean;static?:boolean;ordered?:boolean;unique?:boolean}
export interface UmlParameter {id:string;name:string;type:string;typeId?:string;direction?:'in'|'out'|'inout'|'return';multiplicity?:string;defaultValue?:string}
export interface UmlOperation {id:string;name:string;visibility:UmlVisibility;returnType:string;parameters:UmlParameter[];returnTypeId?:string;abstract?:boolean;static?:boolean;query?:boolean}
export interface UmlSlot {id:string;name:string;type?:string;value:string}
export type UmlDeviceIcon='server'|'desktop'|'android'|'mobile'|'network'|'storage'|'generic'
export type UmlRuntimeIcon='docker'|'jvm'|'nodejs'|'database'|'generic'
export interface UmlElementDetail {deployment?:DeploymentDetail;component?:ComponentDetail;visibility?:UmlVisibility;deviceIcon?:UmlDeviceIcon;runtimeIcon?:UmlRuntimeIcon;attributes?:UmlAttribute[];operations?:UmlOperation[];classifier?:string;slots?:UmlSlot[];abstract?:boolean;leaf?:boolean;literals?:{id:string;name:string}[];templateParameters?:{id:string;name:string;typeId?:string;constraint?:string}[];note?:string;expression?:string}
export const UML_VISIBILITY_SYMBOL:Record<UmlVisibility,string>={public:'+',private:'-',protected:'#',package:'~'}
export function umlAttributeText(item:UmlAttribute,clean=false,names?:Readonly<Record<string,string>>):string{
 const length=!clean&&item.length&&item.length>0?`(${item.length})`:''
 return `${UML_VISIBILITY_SYMBOL[item.visibility]} ${item.derived?'/':''}${item.name}: ${(item.typeId&&names?.[item.typeId])||item.type}${length}${item.multiplicity?` [${item.multiplicity}]`:''}${item.defaultValue?` = ${item.defaultValue}`:''}${[item.readOnly?'readOnly':'',item.ordered?'ordered':'',item.unique?'unique':''].filter(Boolean).map(x=>` {${x}}`).join('')}`
}
export function umlOperationText(item:UmlOperation):string{return umlOperationTextResolved(item)}
export function umlOperationTextResolved(item:UmlOperation,names?:Readonly<Record<string,string>>):string{
 const params=item.parameters.map(p=>`${p.direction&&p.direction!=='in'?p.direction+' ':''}${p.name}: ${(p.typeId&&names?.[p.typeId])||p.type}${p.multiplicity?` [${p.multiplicity}]`:''}${p.defaultValue?` = ${p.defaultValue}`:''}`).join(', ')
 return `${UML_VISIBILITY_SYMBOL[item.visibility]} ${item.name}(${params})${item.returnType?`: ${(item.returnTypeId&&names?.[item.returnTypeId])||item.returnType}`:''}${item.query?' {query}':''}`
}
export const umlObjectTitle=(name:string,classifier?:string)=>classifier?`${name.split(':')[0]}: ${classifier}`:name
export function validUmlDetail(value:unknown):value is UmlElementDetail{
 if(value===undefined)return true
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const x=value as Record<string,unknown>
 if(!validDeploymentDetail(x.deployment)||!validComponentDetail(x.component))return false
 const text=(v:unknown,max=160)=>typeof v==='string'&&v.length<=max
 const entry=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)
 const validName=(v:unknown)=>text(v)&&!!(v as string).trim()
 const visibility=(v:unknown)=>['public','private','protected','package'].includes(String(v))
 if(x.classifier!==undefined&&!text(x.classifier))return false
 if(x.visibility!==undefined&&!visibility(x.visibility))return false
 if(x.deviceIcon!==undefined&&!['server','desktop','android','mobile','network','storage','generic'].includes(String(x.deviceIcon)))return false
 if(x.runtimeIcon!==undefined&&!['docker','jvm','nodejs','database','generic'].includes(String(x.runtimeIcon)))return false
 if(x.attributes!==undefined&&(!Array.isArray(x.attributes)||x.attributes.length>100||!x.attributes.every((a:unknown)=>entry(a)&&validName((a as UmlAttribute).id)&&validName((a as UmlAttribute).name)&&text((a as UmlAttribute).type)&&visibility((a as UmlAttribute).visibility)&&((a as UmlAttribute).length===undefined||Number.isSafeInteger((a as UmlAttribute).length)&&(a as UmlAttribute).length!>=1&&(a as UmlAttribute).length!<=1000000)&&((a as UmlAttribute).multiplicity===undefined||text((a as UmlAttribute).multiplicity))&&((a as UmlAttribute).defaultValue===undefined||text((a as UmlAttribute).defaultValue,500)))))return false
 if(x.operations!==undefined&&(!Array.isArray(x.operations)||x.operations.length>100||!x.operations.every((o:unknown)=>entry(o)&&validName((o as UmlOperation).id)&&validName((o as UmlOperation).name)&&text((o as UmlOperation).returnType)&&visibility((o as UmlOperation).visibility)&&Array.isArray((o as UmlOperation).parameters)&&(o as UmlOperation).parameters.length<=30&&(o as UmlOperation).parameters.every(p=>entry(p)&&validName(p.id)&&validName(p.name)&&text(p.type)))))return false
 const optionalText=(o:Record<string,unknown>,keys:string[])=>keys.every(k=>o[k]===undefined||text(o[k],500))
 const booleans=(o:Record<string,unknown>,keys:string[])=>keys.every(k=>o[k]===undefined||typeof o[k]==='boolean')
 if(Array.isArray(x.attributes)&&!x.attributes.every(a=>optionalText(a,['typeId'])&&booleans(a,['readOnly','derived','static','ordered','unique'])))return false
 if(Array.isArray(x.operations)&&!x.operations.every(o=>optionalText(o,['returnTypeId'])&&booleans(o,['abstract','static','query'])&&o.parameters.every((p:Record<string,unknown>)=>optionalText(p,['typeId','multiplicity','defaultValue'])&&(p.direction===undefined||['in','out','inout','return'].includes(String(p.direction))))))return false
 for(const k of ['abstract','leaf'])if(x[k]!==undefined&&typeof x[k]!=='boolean')return false
 for(const k of ['note','expression'])if(x[k]!==undefined&&!text(x[k],10000))return false
 for(const k of ['literals','templateParameters'])if(x[k]!==undefined&&(!Array.isArray(x[k])||(x[k] as unknown[]).length>100||!(x[k] as unknown[]).every(v=>entry(v)&&validName((v as {id:string}).id)&&validName((v as {name:string}).name))))return false
 if(Array.isArray(x.templateParameters)&&!x.templateParameters.every(p=>optionalText(p,['typeId','constraint'])))return false
 if(x.slots!==undefined&&(!Array.isArray(x.slots)||x.slots.length>100||!x.slots.every((s:unknown)=>entry(s)&&validName((s as UmlSlot).id)&&validName((s as UmlSlot).name)&&text((s as UmlSlot).value,1000)&&((s as UmlSlot).type===undefined||text((s as UmlSlot).type)))))return false
 return true
}
