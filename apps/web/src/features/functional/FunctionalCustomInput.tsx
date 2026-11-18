import {useRef} from 'react'
import type {ReactNode} from 'react'
import {Plus,Trash2,ImagePlus} from 'lucide-react'
import type {FunctionalField} from './api'

type Props={field:FunctionalField;value:unknown;disabled:boolean;onChange:(value:unknown)=>void;onError:(message:string)=>void}
const asStrings=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[]
const asCells=(v:unknown):string[][]=>Array.isArray(v)&&v.every(x=>Array.isArray(x))?v.map(r=>r.map(x=>typeof x==='string'?x:'')):[]
export default function FunctionalCustomInput({field,value,disabled,onChange,onError}:Props){
 const upload=useRef<HTMLInputElement>(null)
 const chooseImage=async(file:File)=>{
  if(file.size>260000||!['image/png','image/jpeg','image/webp'].includes(file.type)){onError('Imagen: PNG/JPG/WebP de máximo 250 KB');return}
  const reader=new FileReader()
  reader.onload=()=>onChange(String(reader.result))
  reader.onerror=()=>onError('No se pudo leer la imagen')
  reader.readAsDataURL(file)
 }
 const type=field.fieldType,strings=asStrings(value)
 const common={disabled,required:field.required}
 let input:ReactNode
 if(type==='boolean')input=<label className="functional-check"><input {...common} type="checkbox" checked={value===true} onChange={e=>onChange(e.target.checked)}/><span>Marcar</span></label>
 else if(type==='select')input=<select {...common} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}><option value="">Seleccionar</option>{field.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
 else if(type==='multi_select'||type==='checkbox_group')input=<div className="functional-choice-list">{field.options.map(o=><label key={o}><input type="checkbox" checked={strings.includes(o)} disabled={disabled} onChange={e=>onChange(e.target.checked?[...strings,o]:strings.filter(x=>x!==o))}/>{o}</label>)}</div>
 else if(type==='long')input=<textarea {...common} rows={4} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}/>
 else if(type==='list')input=<div className="functional-custom-list">{(strings.length?strings:['']).map((x,i)=><div className="functional-step" key={i}><span>{i+1}.</span><input aria-label={`${field.name}: elemento ${i+1}`} disabled={disabled} value={x} onChange={e=>onChange((strings.length?strings:['']).map((t,j)=>i===j?e.target.value:t))}/><button aria-label={`Eliminar elemento ${i+1}`} className="ghost" disabled={disabled} onClick={()=>onChange(strings.filter((_,j)=>j!==i))}><Trash2 size={14}/></button></div>)}<button className="ghost" disabled={disabled||strings.length>=60} onClick={()=>onChange([...strings,''])}><Plus size={14}/> Añadir elemento</button></div>
 else if(type==='table'){
  const cells=asCells(value),rows=Math.max(2,cells.length||3),cols=Math.max(2,cells[0]?.length||3)
  const matrix=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>cells[r]?.[c]||''))
  const resize=(r:number,c:number)=>onChange(Array.from({length:r},(_,ri)=>Array.from({length:c},(_,ci)=>matrix[ri]?.[ci]||'')))
  input=<div className="functional-data-table"><div className="functional-table-controls"><button className="ghost" disabled={disabled||rows>=20} onClick={()=>resize(rows+1,cols)}>+ Fila</button><button className="ghost" disabled={disabled||rows<=2} onClick={()=>resize(rows-1,cols)}>− Fila</button><button className="ghost" disabled={disabled||cols>=12} onClick={()=>resize(rows,cols+1)}>+ Columna</button><button className="ghost" disabled={disabled||cols<=2} onClick={()=>resize(rows,cols-1)}>− Columna</button></div><div className="functional-table-scroll"><table><tbody>{matrix.map((row,r)=><tr key={r}>{row.map((x,c)=><td key={c}><input aria-label={`${field.name}: fila ${r+1}, columna ${c+1}`} value={x} disabled={disabled} onChange={e=>onChange(matrix.map((a,ri)=>a.map((v,ci)=>ri===r&&ci===c?e.target.value:v)))}/></td>)}</tr>)}</tbody></table></div></div>
 }else if(type==='image')input=<div className="functional-image-input"><input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={disabled} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void chooseImage(f)}}/>{typeof value==='string'&&value.startsWith('data:image/')?<img src={value} alt={`Imagen del campo ${field.name}`}/>:<span>No se ha seleccionado una imagen</span>}<div className="functional-export-row"><button className="ghost" disabled={disabled} onClick={()=>upload.current?.click()}><ImagePlus size={15}/> Seleccionar imagen</button>{!!value&&<button className="ghost" disabled={disabled} onClick={()=>onChange('')}>Quitar</button>}</div><small>Imagen del formulario, independiente de la decoración fija de la plantilla.</small></div>
 else if(type==='number'||type==='currency')input=<input {...common} type="number" step={type==='currency'?'0.01':'any'} value={typeof value==='number'?value:''} onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/>
 else input=<input {...common} type={type==='date'?'date':type==='time'?'time':type==='datetime'?'datetime-local':type==='url'?'url':type==='email'?'email':'text'} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}/>
 return <div className={'functional-field functional-input-'+type}><span>{field.name} {field.required&&<strong>*</strong>}</span>{input}</div>
}
