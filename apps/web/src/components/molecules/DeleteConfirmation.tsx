import {useState} from 'react'
import {Overlay,Field} from './Overlay'

/** Confirmación accesible en la interfaz de ATLAS: sin prompt/alert del navegador. */
export function DeleteConfirmation({title,name,description,consequences,busy,error,onCancel,onConfirm,checkboxLabel}:{
 title:string;name:string;description:string;consequences?:string;busy:boolean;error:string;
 onCancel:()=>void;onConfirm:()=>Promise<void>;checkboxLabel?:string
}){
 const [typed,setTyped]=useState('')
 const [acknowledged,setAcknowledged]=useState(false)
 const matched=typed===name&&(!checkboxLabel||acknowledged)
 return <Overlay title={title} onClose={()=>{if(!busy)onCancel()}}>
  <div className="modal-body delete-confirmation">
   <p className="sec-help">{description}</p>
   {consequences&&<p className="delete-warning" role="note">{consequences}</p>}
   {error&&<div className="sec-error" role="alert">{error}</div>}
   {checkboxLabel&&<label className="delete-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/><span>{checkboxLabel}</span></label>}
   <Field label={`Para confirmar, escribe exactamente «${name}»`}>
    <input autoFocus value={typed} autoComplete="off" disabled={busy} onChange={e=>setTyped(e.target.value)} aria-label="Escribe el nombre para confirmar la eliminación"/>
   </Field>
   <div className="modal-actions"><button className="ghost" disabled={busy} onClick={onCancel}>Cancelar</button><button className="danger outlined" disabled={busy||!matched} onClick={()=>void onConfirm()}>{busy?'Eliminando…':'Eliminar definitivamente'}</button></div>
  </div>
 </Overlay>
}
