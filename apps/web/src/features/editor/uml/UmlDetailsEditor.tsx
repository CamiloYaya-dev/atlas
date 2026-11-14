import type {ModelElement,UmlAttribute,UmlOperation,UmlParameter,UmlSlot,UmlVisibility} from '@atlas/contracts'
import {Plus,Trash2} from 'lucide-react'
import type {ReactNode} from 'react'

type Props={element:ModelElement;disabled:boolean;onChange:(uml:NonNullable<ModelElement['uml']>)=>void}
const visibilities:UmlVisibility[]=['public','private','protected','package']
const names:Record<UmlVisibility,string>={public:'+ Público',private:'− Privado',protected:'# Protegido',package:'~ Paquete'}
const nextId=()=>crypto.randomUUID()
const Field=({label,children}:{label:string;children:ReactNode})=><label className="uml-property-field"><span>{label}</span>{children}</label>

export default function UmlDetailsEditor({element,disabled,onChange}:Props){
 const uml=element.uml||{}
 const set=(patch:Partial<NonNullable<ModelElement['uml']>>)=>onChange({...uml,...patch})
 const classType=['uml-class','uml-interface','uml-enumeration'].includes(element.type)
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
   <div className="uml-properties-heading"><b>Atributos</b><button type="button" disabled={disabled} onClick={()=>set({attributes:[...attrs,{id:nextId(),name:'atributo',type:'String',visibility:'private'}]})}><Plus size={13}/> Atributo</button></div>
   {attrs.map(a=><div className="uml-property-row" key={a.id}>
    <Field label="Nombre"><input aria-label={`Nombre atributo ${a.id}`} disabled={disabled} value={a.name} onChange={e=>setAttribute(a.id,{name:e.target.value})}/></Field>
    <Field label="Tipo de dato"><input aria-label={`Tipo atributo ${a.id}`} disabled={disabled} value={a.type} onChange={e=>setAttribute(a.id,{type:e.target.value})} placeholder="String, Integer…"/></Field>
    <Field label="Ancho / longitud"><input type="number" min={1} max={1000000} aria-label={`Longitud atributo ${a.id}`} disabled={disabled} value={a.length??''} onChange={e=>setAttribute(a.id,{length:e.target.value?Number(e.target.value):undefined})}/></Field>
    <Field label="Visibilidad"><select aria-label={`Visibilidad atributo ${a.id}`} value={a.visibility} disabled={disabled} onChange={e=>setAttribute(a.id,{visibility:e.target.value as UmlVisibility})}>{visibilities.map(v=><option value={v} key={v}>{names[v]}</option>)}</select></Field>
    <Field label="Multiplicidad"><input aria-label={`Multiplicidad atributo ${a.id}`} disabled={disabled} value={a.multiplicity||''} placeholder="0..*" onChange={e=>setAttribute(a.id,{multiplicity:e.target.value})}/></Field>
    <Field label="Valor inicial"><input aria-label={`Valor inicial atributo ${a.id}`} disabled={disabled} value={a.defaultValue||''} onChange={e=>setAttribute(a.id,{defaultValue:e.target.value})}/></Field>
    <button type="button" className="uml-remove" disabled={disabled} onClick={()=>set({attributes:attrs.filter(x=>x.id!==a.id)})} aria-label={`Quitar atributo ${a.name}`}><Trash2 size={14}/> Quitar atributo</button>
   </div>)}
   <div className="uml-properties-heading"><b>Operaciones / Métodos</b><button type="button" disabled={disabled} onClick={()=>set({operations:[...operations,{id:nextId(),name:'operacion',returnType:'void',visibility:'public',parameters:[]}]})}><Plus size={13}/> Operación</button></div>
   {operations.map(o=><div className="uml-property-row" key={o.id}>
    <Field label="Nombre"><input aria-label={`Nombre operación ${o.id}`} disabled={disabled} value={o.name} onChange={e=>setOperation(o.id,{name:e.target.value})}/></Field>
    <Field label="Retorna"><input aria-label={`Retorno operación ${o.id}`} disabled={disabled} value={o.returnType} onChange={e=>setOperation(o.id,{returnType:e.target.value})}/></Field>
    <Field label="Visibilidad"><select aria-label={`Visibilidad operación ${o.id}`} disabled={disabled} value={o.visibility} onChange={e=>setOperation(o.id,{visibility:e.target.value as UmlVisibility})}>{visibilities.map(v=><option key={v} value={v}>{names[v]}</option>)}</select></Field>
    <div className="uml-parameters"><b>Parámetros</b>{o.parameters.map((p:UmlParameter)=><div key={p.id} className="uml-parameter-row"><input aria-label={`Nombre parámetro ${p.id}`} disabled={disabled} placeholder="Nombre" value={p.name} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,name:e.target.value}:q)})}/><input aria-label={`Tipo parámetro ${p.id}`} disabled={disabled} placeholder="Tipo" value={p.type} onChange={e=>setOperation(o.id,{parameters:o.parameters.map(q=>q.id===p.id?{...q,type:e.target.value}:q)})}/><button type="button" aria-label={`Quitar parámetro ${p.name}`} disabled={disabled} onClick={()=>setOperation(o.id,{parameters:o.parameters.filter(q=>q.id!==p.id)})}><Trash2 size={13}/></button></div>)}<button type="button" disabled={disabled} onClick={()=>setOperation(o.id,{parameters:[...o.parameters,{id:nextId(),name:'parametro',type:'String'}]})}><Plus size={12}/> Parámetro</button></div>
    <button type="button" className="uml-remove" disabled={disabled} onClick={()=>set({operations:operations.filter(x=>x.id!==o.id)})}><Trash2 size={14}/> Quitar operación</button>
   </div>)}
  </>}
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
