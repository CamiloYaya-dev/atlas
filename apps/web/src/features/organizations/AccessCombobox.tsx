import {useEffect,useId,useRef,useState} from 'react'

type Choice={id:string;label:string;description?:string}
export default function AccessCombobox({label,items,value,onChange,placeholder,disabled,onQueryChange}:{label:string;items:Choice[];value:string;onChange:(id:string)=>void;placeholder?:string;disabled?:boolean;onQueryChange?:(q:string)=>void}){
 const popupId=useId()
 const selected=items.find(x=>x.id===value)
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0)
 const root=useRef<HTMLDivElement>(null)
 const filtered=items.filter(x=>`${x.label} ${x.description||''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,40)
 useEffect(()=>{if(selected)setQuery(selected.label)},[value,selected?.label])
 useEffect(()=>{const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
 const choose=(x:Choice)=>{onChange(x.id);setQuery(x.label);setOpen(false)}
 return <div className="novzi-access-combo" ref={root}>
  <label>{label}<input role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?popupId:undefined} disabled={disabled} placeholder={placeholder||`Buscar ${label.toLowerCase()}`} value={query}
   onFocus={()=>{setOpen(true);setActive(0)}} onChange={e=>{setQuery(e.target.value);onChange('');onQueryChange?.(e.target.value);setOpen(true);setActive(0)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,filtered.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1))}if(e.key==='Enter'&&open&&filtered[active]){e.preventDefault();choose(filtered[active])}}}/></label>
  {open&&!disabled&&<div role="listbox" id={popupId} className="novzi-access-options">{filtered.length?filtered.map((item,i)=><button type="button" key={item.id} role="option" aria-selected={value===item.id} className={i===active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)}><strong>{item.label}</strong>{item.description&&<small>{item.description}</small>}</button>):<div className="novzi-access-no-results">Sin coincidencias</div>}</div>}
 </div>
}
