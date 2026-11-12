import {useId} from 'react'
import type {ReactNode} from 'react'
import {X} from 'lucide-react'
export function Overlay({children,onClose,title,wide=false}:{children:ReactNode;onClose:()=>void;title:string;wide?:boolean}){const titleId=useId();return <div className="overlay" onMouseDown={onClose}><div className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>{children}</div></div>}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="form-field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
