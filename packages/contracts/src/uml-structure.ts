/** UML structural detail is attached to the shared element; package membership belongs to a diagram occurrence. */
export type UmlVisibility='public'|'private'|'protected'|'package'
export interface UmlAttribute {id:string;name:string;type:string;visibility:UmlVisibility;multiplicity?:string;length?:number;defaultValue?:string}
export interface UmlParameter {id:string;name:string;type:string}
export interface UmlOperation {id:string;name:string;visibility:UmlVisibility;returnType:string;parameters:UmlParameter[]}
export interface UmlSlot {id:string;name:string;type?:string;value:string}
export type UmlDeviceIcon='server'|'desktop'|'android'|'mobile'|'network'|'storage'|'generic'
export type UmlRuntimeIcon='docker'|'jvm'|'nodejs'|'database'|'generic'
export interface UmlElementDetail {deviceIcon?:UmlDeviceIcon;runtimeIcon?:UmlRuntimeIcon;attributes?:UmlAttribute[];operations?:UmlOperation[];classifier?:string;slots?:UmlSlot[]}
export const UML_VISIBILITY_SYMBOL:Record<UmlVisibility,string>={public:'+',private:'-',protected:'#',package:'~'}
export function umlAttributeText(item:UmlAttribute):string{
 const length=item.length&&item.length>0?`(${item.length})`:''
 return `${UML_VISIBILITY_SYMBOL[item.visibility]} ${item.name}: ${item.type}${length}${item.multiplicity?` [${item.multiplicity}]`:''}${item.defaultValue?` = ${item.defaultValue}`:''}`
}
export function umlOperationText(item:UmlOperation):string{
 const params=item.parameters.map(p=>`${p.name}: ${p.type}`).join(', ')
 return `${UML_VISIBILITY_SYMBOL[item.visibility]} ${item.name}(${params})${item.returnType?`: ${item.returnType}`:''}`
}
export const umlObjectTitle=(name:string,classifier?:string)=>classifier?`${name.split(':')[0]}: ${classifier}`:name
export function validUmlDetail(value:unknown):value is UmlElementDetail{
 if(value===undefined)return true
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const x=value as Record<string,unknown>
 const text=(v:unknown,max=160)=>typeof v==='string'&&v.length<=max
 const entry=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)
 const validName=(v:unknown)=>text(v)&&!!(v as string).trim()
 const visibility=(v:unknown)=>['public','private','protected','package'].includes(String(v))
 if(x.classifier!==undefined&&!text(x.classifier))return false
 if(x.deviceIcon!==undefined&&!['server','desktop','android','mobile','network','storage','generic'].includes(String(x.deviceIcon)))return false
 if(x.runtimeIcon!==undefined&&!['docker','jvm','nodejs','database','generic'].includes(String(x.runtimeIcon)))return false
 if(x.attributes!==undefined&&(!Array.isArray(x.attributes)||x.attributes.length>100||!x.attributes.every((a:unknown)=>entry(a)&&validName((a as UmlAttribute).id)&&validName((a as UmlAttribute).name)&&text((a as UmlAttribute).type)&&visibility((a as UmlAttribute).visibility)&&((a as UmlAttribute).length===undefined||Number.isSafeInteger((a as UmlAttribute).length)&&(a as UmlAttribute).length!>=1&&(a as UmlAttribute).length!<=1000000)&&((a as UmlAttribute).multiplicity===undefined||text((a as UmlAttribute).multiplicity))&&((a as UmlAttribute).defaultValue===undefined||text((a as UmlAttribute).defaultValue,500)))))return false
 if(x.operations!==undefined&&(!Array.isArray(x.operations)||x.operations.length>100||!x.operations.every((o:unknown)=>entry(o)&&validName((o as UmlOperation).id)&&validName((o as UmlOperation).name)&&text((o as UmlOperation).returnType)&&visibility((o as UmlOperation).visibility)&&Array.isArray((o as UmlOperation).parameters)&&(o as UmlOperation).parameters.length<=30&&(o as UmlOperation).parameters.every(p=>entry(p)&&validName(p.id)&&validName(p.name)&&text(p.type)))))return false
 if(x.slots!==undefined&&(!Array.isArray(x.slots)||x.slots.length>100||!x.slots.every((s:unknown)=>entry(s)&&validName((s as UmlSlot).id)&&validName((s as UmlSlot).name)&&text((s as UmlSlot).value,1000)&&((s as UmlSlot).type===undefined||text((s as UmlSlot).type)))))return false
 return true
}
