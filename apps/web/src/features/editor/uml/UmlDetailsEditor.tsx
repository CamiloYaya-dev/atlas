import {classCapabilities,isClassType,classTypeReferenceAllowed,validMultiplicity} from '@atlas/contracts'
import type {ModelElement,UmlAttribute,UmlOperation,UmlParameter,UmlSlot,UmlVisibility} from '@atlas/contracts'
import {Plus,Trash2} from 'lucide-react'
import {useEffect,useState,useId} from 'react'
import type {ReactNode} from 'react'

type Props={componentContext?:boolean;element:ModelElement;catalog?:Record<string,ModelElement>;disabled:boolean;onChange:(uml:NonNullable<ModelElement['uml']>)=>void}
const visibilities:UmlVisibility[]=['public','private','protected','package']
const names:Record<UmlVisibility,string>={public:'+ Público',private:'− Privado',protected:'# Protegido',package:'~ Paquete'}
const nextId=()=>crypto.randomUUID()
const Field=({label,children}:{label:string;children:ReactNode})=><label className="uml-property-field"><span>{label}</span>{children}</label>

/** Invalid intermediate text belongs to the field, never to autosave. */
function ValidatedText({label,value,disabled,validate,message,onChange,placeholder}:{label:string;value:string;disabled:boolean;validate:(v:string)=>boolean;message:string;onChange:(v:string)=>void;placeholder?:string}){
 const [draft,setDraft]=useState<string|null>(null),errorId=useId()
 const text=draft??value,invalid=!validate(text)
 useEffect(()=>{setDraft(null)},[value])
 return <div className="uml-validated-field"><input aria-label={label} disabled={disabled} value={text} placeholder={placeholder} aria-invalid={invalid} aria-describedby={invalid?errorId:undefined} onChange={e=>{const next=e.target.value;if(validate(next)){setDraft(null);onChange(next)}else setDraft(next)}}/>{invalid&&<small id={errorId} role="alert" className="uml-inline-error">{message}</small>}</div>
}
const multiplicityMessage='Multiplicidad inválida. Usa 1, 0..1, 1..*, * o vacío.'
const nextParameterName=(parameters:UmlParameter[])=>{let i=1;while(parameters.some(p=>p.name===(i===1?'parametro':`parametro${i}`)))i++;return i===1?'parametro':`parametro${i}`}
const validMemberName=(v:string)=>!!v.trim()&&v.length<=160
export default function UmlDetailsEditor({element,disabled,onChange,catalog={},componentContext}:Props){
 const uml=element.uml||{}
 const set=(patch:Partial<NonNullable<ModelElement['uml']>>)=>onChange({...uml,...patch})
 const ucClassifier=element.type==='actor'||element.type==='usecase'
 const component=componentContext&&['component','uml-artifact'].includes(element.type)
 const classType=component||ucClassifier||isClassType(element.type)||element.type==='uml-stereotype'
 const capabilities=classCapabilities(element.type),attrsAllowed=component||ucClassifier||capabilities.attributes||element.type==='uml-stereotype',opsAllowed=component||ucClassifier||capabilities.operations||element.type==='uml-stereotype'
 const choices=element.type==='uml-interface'?(['public'] as const):visibilities
 const types=Object.values(catalog).filter(e=>classTypeReferenceAllowed(e.type))
 const typeChoices=<><option value="">Tipo externo (texto)</option>{types.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</>
 const isObject=element.type==='uml-object'
 if(!classType&&!isObject)return null
 const attrs=uml.attributes||[],operations=uml.operations||[],slots=uml.slots||[]
 const setAttribute=(id:string,patch:Partial<UmlAttribute>)=>set({attributes:attrs.map(a=>a.id===id?{...a,...patch}:a)})
 const setOperation=(id:string,patch:Partial<UmlOperation>)=>set({operations:operations.map(o=>o.id===id?{...o,...patch}:o)})
 const setSlot=(id:string,patch:Partial<UmlSlot>)=>set({slots:slots.map(s=>s.id===id?{...s,...patch}:s)})
 return <section className="uml-properties" aria-label={classType?'Estructura UML de clase':'Valores de la instancia UML'}>
  <div className="section-head"><strong>{classType?'Estructura de clase UML':'Instancia de objeto UML'}</strong></div>
  {classType&&<>
   <p className="muted-mini">Los atributos y operaciones se dibujan en compartimentos reales. El tipo, ancho, visibilidad y parámetros se guardan en la ficha compartida.</p>
   {capabilities.abstract&&<Field label="Clase abstracta"><input type="checkbox" checked={!!uml.abstract} disabled={disabled||!!uml.leaf} onChange={e=>set({abstract:e.target.checked})}/></Field>}
   {capabilities.flags&&<Field label="Clasificador final"><input type="checkbox" checked={!!uml.leaf} disabled={disabled||!!uml.abstract} onChange={e=>set({leaf:e.target.checked})}/></Field>}
   {capabilities.note&&<Field label={element.type==='uml-constraint'?'Expresión de restricción':'Texto del comentario'}><textarea disabled={disabled} value={element.type==='uml-constraint'?uml.expression||'':uml.note||''} onChange={e=>set(element.type==='uml-constraint'?{expression:e.target.value}:{note:e.target.value})}/></Field>}
   {capabilities.package&&<Field label="Visibilidad del paquete"><select disabled={disabled} value={uml.visibility||'public'} onChange={e=>set({visibility:e.target.value as UmlVisibility})}><option value="public">Público</option><option value="private">Privado</option></select></Field>}
   {capabilities.literals&&<><div className="uml-properties-heading"><b>Literales UML</b><button type="button" disabled={disabled} onClick={()=>set({literals:[...uml.literals||[],{id:nextId(),name:`LITERAL_${(uml.literals?.length||0)+1}`}]})}>Literal</button></div>{uml.literals?.map(l=><div key={l.id}><Field label="Literal"><input disabled={disabled} value={l.name} onChange={e=>set({literals:uml.literals?.map(x=>x.id===l.id?{...x,name:e.target.value}:x)})}/></Field><button disabled={disabled} onClick={()=>set({literals:uml.literals?.filter(x=>x.id!==l.id)})}>Quitar literal {l.name}</button></div>)}</>}
   {capabilities.template&&<><div className="uml-properties-heading"><b>Parámetros de plantilla</b><button disabled={disabled} onClick={()=>set({templateParameters:[...uml.templateParameters||[],{id:nextId(),name:`T${(uml.templateParameters?.length||0)+1}`}]})}>Parámetro formal</button></div>{uml.templateParameters?.map(p=><div key={p.id}><Field label="Parámetro formal"><input disabled={disabled} value={p.name} onChange={e=>set({templateParameters:uml.templateParameters?.map(x=>x.id===p.id?{...x,name:e.target.value}:x)})}/></Field>{!!types.length&&<Field label="Tipo formal referenciado"><select disabled={disabled} value={p.typeId||''} onChange={e=>set({templateParameters:uml.templateParameters?.map(x=>x.id===p.id?{...x,typeId:e.target.value||undefined}:x)})}>{typeChoices}</select></Field>}<Field label="Restricción formal"><input disabled={disabled} value={p.constraint||''} onChange={e=>set({templateParameters:uml.templateParameters?.map(x=>x.id===p.id?{...x,constraint:e.target.value}:x)})}/></Field><button disabled={disabled} onClick={()=>set({templateParameters:uml.templateParameters?.filter(x=>x.id!==p.id)})}>Quitar parámetro formal {p.name}</button></div>)}</>}
   {attrsAllowed&&<><div className="uml-properties-heading"><b>Atributos</b><button type="button" disabled={disabled} onClick={()=>set({attributes:[...attrs,{id:nextId(),name:attrs.length?`atributo${attrs.length+1}`:'atributo',type:'String',visibility:element.type==='uml-interface'?'public':'private',...(element.type==='uml-enumeration'?{readOnly:true}:{})}]})}><Plus size={13}/> Atributo</button></div>
   {attrs.map(a=><div className="uml-property-row" key={a.id}>
    <Field label="Nombre"><ValidatedText label={`Nombre atributo ${a.id}`} disabled={disabled} value={a.name} validate={validMemberName} message="Escribe un nombre válido." onChange={value=>setAttribute(a.id,{name:value})}/></Field>
    <Field label="Tipo de dato"><input aria-label={`Tipo atributo ${a.id}`} disabled={disabled} value={a.typeId&&catalog[a.typeId]?catalog[a.typeId].name:a.type} readOnly={!!a.typeId} onChange={e=>setAttribute(a.id,{type:e.target.value})} placeholder="String, Integer…"/></Field>
    {!!types.length&&<Field label="Referencia de tipo"><select disabled={disabled} value={a.typeId||''} onChange={e=>setAttribute(a.id,{typeId:e.target.value||undefined,...(e.target.value?{type:catalog[e.target.value].name}:{})})}>{typeChoices}</select></Field>}
    <Field label="Ancho / longitud"><input type="number" min={1} max={1000000} aria-label={`Longitud atributo ${a.id}`} disabled={disabled} value={a.length??''} onChange={e=>setAttribute(a.id,{length:e.target.value?Number(e.target.value):undefined})}/></Field>
    <Field label="Visibilidad"><select aria-label={`Visibilidad atributo ${a.id}`} value={a.visibility} disabled={disabled} onChange={e=>setAttribute(a.id,{visibility:e.target.value as UmlVisibility})}>{choices.map(v=><option value={v} key={v}>{names[v]}</option>)}</select></Field>
    <Field label="Multiplicidad"><ValidatedText key={a.id} label={`Multiplicidad atributo ${a.id}`} disabled={disabled} value={a.multiplicity||''} placeholder="0..*" validate={validMultiplicity} message={multiplicityMessage} onChange={value=>setAttribute(a.id,{multiplicity:value})}/></Field>
    <Field label="Valor inicial"><input aria-label={`Valor inicial atributo ${a.id}`} disabled={disabled} value={a.defaultValue||''} onChange={e=>setAttribute(a.id,{defaultValue:e.target.value})}/></Field>
    {(['readOnly','derived','static','ordered','unique'] as const).map(flag=><Field key={flag} label={flag}><input type="checkbox" disabled={disabled||flag==='readOnly'&&element.type==='uml-enumeration'} checked={!!a[flag]} onChange={e=>setAttribute(a.id,{[flag]:e.target.checked})}/></Field>)}
    <button type="button" className="uml-remove" disabled={disabled} onClick={()=>set({attributes:attrs.filter(x=>x.id!==a.id)})} aria-label={`Quitar atributo ${a.name}`}><Trash2 size={14}/> Quitar atributo</button>
   </div>)}
   </>}{opsAllowed&&<><div className="uml-properties-heading"><b>Operaciones / Métodos</b><button type="button" disabled={disabled} onClick={()=>set({operations:[...operations,{id:nextId(),name:operations.length?`operacion${operations.length+1}`:'operacion',returnType:'void',visibility:'public',parameters:[]}]})}><Plus size={13}/> Operación</button></div>
   {operations.map(o=><div className="uml-property-row" key={o.id}>
    <Field label="Nombre"><ValidatedText label={`Nombre operación ${o.id}`} disabled={disabled} value={o.name} validate={validMemberName} message="Escribe un nombre válido." onChange={value=>setOperation(o.id,{name:value})}/></Field>
    <Field label="Retorna"><input aria-label={`Retorno operación ${o.id}`} disabled={disabled} value={o.returnTypeId&&catalog[o.returnTypeId]?catalog[o.returnTypeId].name:o.returnType} readOnly={!!o.returnTypeId} onChange={e=>setOperation(o.id,{returnType:e.target.value})}/></Field>
    {!!types.length&&<Field label="Tipo de retorno referenciado"><select disabled={disabled} value={o.returnTypeId||''} onChange={e=>setOperation(o.id,{returnTypeId:e.target.value||undefined,...(e.target.value?{returnType:catalog[e.target.value].name}:{})})}>{typeChoices}</select></Field>}
    <Field label="Visibilidad"><select aria-label={`Visibilidad operación ${o.id}`} disabled={disabled} value={o.visibility} onChange={e=>setOperation(o.id,{visibility:e.target.value as UmlVisibility})}>{choices.map(v=><option key={v} value={v}>{names[v]}</option>)}</select></Field>
    {(['abstract','static','query'] as const).map(flag=><Field key={flag} label={flag}><input type="checkbox" disabled={disabled} checked={!!o[flag]} onChange={e=>setOperation(o.id,{[flag]:e.target.checked})}/></Field>)}
    <div className="uml-parameters"><b>Parámetros</b>{o.parameters.map((p:UmlParameter)=><div key={p.id} className="uml-parameter-scroll" tabIndex={0} role="region" aria-label={`Campos del parámetro ${p.name}`}><div className="uml-parameter-row">
    <Field label="Nombre"><ValidatedText label={`Nombre parámetro ${p.id}`} disabled={disabled} value={p.name} validate={validMemberName} message="Escribe un nombre válido." onChange={value=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,name:value}:q)})}/></Field>
    <Field label="Tipo"><input aria-label={`Tipo parámetro ${p.id}`} disabled={disabled} placeholder="Tipo" value={p.typeId&&catalog[p.typeId]?catalog[p.typeId].name:p.type} readOnly={!!p.typeId} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,type:e.target.value}:q)})}/></Field>
    <Field label="Dirección"><select aria-label={`Dirección parámetro ${p.id}`} disabled={disabled} value={p.direction||'in'} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,direction:e.target.value as UmlParameter['direction']}:q)})}>{['in','out','inout','return'].map(x=><option key={x} disabled={x==='return'&&o.parameters.some(q=>q.id!==p.id&&q.direction==='return')}>{x}</option>)}</select></Field>
    <Field label="Multiplicidad"><ValidatedText label={`Multiplicidad parámetro ${p.id}`} disabled={disabled} value={p.multiplicity||''} placeholder="0..*" validate={validMultiplicity} message={multiplicityMessage} onChange={value=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,multiplicity:value}:q)})}/></Field>
    <Field label="Valor inicial"><input aria-label={`Valor inicial parámetro ${p.id}`} disabled={disabled} value={p.defaultValue||''} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,defaultValue:e.target.value}:q)})}/></Field>
    {!!types.length&&<Field label="Referencia de tipo"><select aria-label={`Referencia parámetro ${p.id}`} disabled={disabled} value={p.typeId||''} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,typeId:e.target.value||undefined,...(e.target.value?{type:catalog[e.target.value].name}:{})}:q)})}>{typeChoices}</select></Field>}
    <button type="button" aria-label={`Quitar parámetro ${p.name}`} disabled={disabled} onClick={()=>setOperation(o.id,{parameters:o.parameters.filter(q=>q.id!==p.id)})}><Trash2 size={13}/></button></div></div>)}<button type="button" disabled={disabled||o.parameters.length>=30} onClick={()=>setOperation(o.id,{parameters:[...o.parameters,{id:nextId(),name:nextParameterName(o.parameters),type:'String'}]})}><Plus size={12}/> Parámetro</button></div>
    <button type="button" className="uml-remove" disabled={disabled} onClick={()=>set({operations:operations.filter(x=>x.id!==o.id)})}><Trash2 size={14}/> Quitar operación</button>
   </div>)}
  </>}</>}
  {isObject&&<>
   <p className="muted-mini">Representa una instancia de una clase. Su título se subraya como objeto:clase y los slots muestran valores concretos, no declaraciones.</p>
   <Field label="Clase del objeto"><input aria-label="Clase de la instancia" value={uml.classifier||''} disabled={disabled} placeholder="Solicitud" onChange={e=>set({classifier:e.target.value})}/></Field>
   <div className="uml-properties-heading"><b>Valores de atributos (slots)</b><button type="button" disabled={disabled} onClick={()=>set({slots:[...slots,{id:nextId(),name:'atributo',type:'String',value:''}]})}><Plus size={13}/> Valor</button></div>
   {slots.map(s=><div className="uml-property-row" key={s.id}>
    <Field label="Atributo"><input aria-label={`Atributo slot ${s.id}`} disabled={disabled} value={s.name} onChange={e=>setSlot(s.id,{name:e.target.value})}/></Field>
    <Field label="Tipo"><input aria-label={`Tipo slot ${s.id}`} disabled={disabled} value={s.type||''} onChange={e=>setSlot(s.id,{type:e.target.value})}/></Field>
    <Field label="Valor"><input aria-label={`Valor slot ${s.id}`} disabled={disabled} value={s.value} onChange={e=>setSlot(s.id,{value:e.target.value})}/></Field>
    <button type="button" className="uml-remove" disabled={disabled} onClick={()=>set({slots:slots.filter(x=>x.id!==s.id)})}><Trash2 size={14}/> Quitar valor</button>
   </div>)}
  </>}
 </section>
}
