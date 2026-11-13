import {useMemo} from 'react'
import {availableExportFields} from '@atlas/contracts'
import type {AdvancedExportMode,Diagram,ExportFieldChoices,ExportPlacement,ProjectDocument} from '@atlas/contracts'

export function defaultExportChoices(doc:ProjectDocument,diagram:Diagram):ExportFieldChoices{
 const selected:ExportFieldChoices={}
 for(const node of diagram.nodes){
  const element=doc.elements[node.elementId]
  if(!element)continue
  selected[node.id]={}
  for(const field of availableExportFields(doc,diagram,element.id)){
   selected[node.id][field.key]=!field.value.trim()?'omit':field.key==='summary'?'embed':'dictionary'
  }
 }
 return selected
}
export function normalizeChoices(current:ExportFieldChoices,mode:AdvancedExportMode):ExportFieldChoices{
 const normalized:ExportFieldChoices={}
 for(const [elementId,fields] of Object.entries(current)){
  normalized[elementId]={}
  for(const [key,placement] of Object.entries(fields)){
   normalized[elementId][key]=placement==='embed'&&!['embedded','both'].includes(mode)||placement==='dictionary'&&!['dictionary','both'].includes(mode)?'omit':placement
  }
 }
 return normalized
}

/** Permite elegir, para cada campo de cada caja, si viaja en imagen, diccionario u omitido. */
export default function AdvancedExportFields({doc,diagram,mode,choices,onChange}:{doc:ProjectDocument;diagram:Diagram;mode:AdvancedExportMode;choices:ExportFieldChoices;onChange:(value:ExportFieldChoices)=>void}){
 const items=useMemo(()=>diagram.nodes.map(node=>({id:node.id,element:doc.elements[node.elementId],fields:availableExportFields(doc,diagram,node.elementId)})).filter(item=>item.element),[doc,diagram])
 const setField=(id:string,key:string,placement:ExportPlacement)=>onChange({...choices,[id]:{...choices[id],[key]:placement}})
 const setAll=(placement:ExportPlacement)=>{
  const next:ExportFieldChoices={}
  for(const item of items)next[item.id]=Object.fromEntries(item.fields.map(field=>[field.key,field.value?placement:'omit']))
  onChange(next)
 }
 const available=['embedded','both'].includes(mode)?true:false
 return <section className="atlas-export-fields" aria-label="Selección avanzada de campos">
  <p className="muted-mini">Elige qué incluir en cada caja. Los datos se obtienen de la versión guardada; los campos vacíos se omiten del resultado.</p>
  <div className="atlas-export-bulk">
   <button type="button" className="ghost" onClick={()=>setAll('omit')}>Omitir todos</button>
   {available&&<button type="button" className="ghost" onClick={()=>setAll('embed')}>Todos en imagen</button>}
   {['dictionary','both'].includes(mode)&&<button type="button" className="ghost" onClick={()=>setAll('dictionary')}>Todos al diccionario</button>}
  </div>
  <div className="atlas-export-field-scroller">
   {items.map(item=><div className="atlas-export-element" key={item.id}>
    <strong>{item.element?.name}</strong><small>{item.element?.type} · {item.fields.length} campos posibles</small>
    {item.fields.map(field=><label key={field.key} className="atlas-export-field-row">
     <span><b>{field.label}</b><small title={field.value}>{field.value||'(sin valor)'}</small></span>
     <select aria-label={`Exportación · ${item.element?.name} · ${field.label}`} value={choices[item.id]?.[field.key]||'omit'} onChange={event=>setField(item.id,field.key,event.target.value as ExportPlacement)}>
      <option value="omit">Omitir</option>
      {available&&<option value="embed">En imagen</option>}
      {['dictionary','both'].includes(mode)&&<option value="dictionary">Diccionario</option>}
     </select>
    </label>)}
   </div>)}
  </div>
 </section>
}
