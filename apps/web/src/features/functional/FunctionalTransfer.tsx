import {useRef,useState} from 'react'
import {ArrowLeft,Download,Upload,FileJson} from 'lucide-react'
import {downloadJSON,exportFunctionalSchemas,importFunctionalSchemas,FUNCTIONAL_KINDS,KIND_LABELS,TRANSFER_FORMAT} from './api'
import type {FunctionalKind,TransferSelection,TransferScope} from './api'

type Props={projectId:string;activeKind:FunctionalKind;canExport:boolean;canFields:boolean;canTemplates:boolean;onClose:()=>void;onImported:()=>Promise<void>}
const options:{value:TransferScope;label:string}[]=[{value:'none',label:'No incluir'},{value:'form',label:'Solo formulario'},{value:'template',label:'Solo plantilla(s)'},{value:'both',label:'Formulario + plantilla(s)'}]
export default function FunctionalTransfer({projectId,activeKind,canExport,canFields,canTemplates,onClose,onImported}:Props){
 const [selection,setSelection]=useState<TransferSelection>({finding:activeKind==='finding'?'both':'none',rf:activeKind==='rf'?'both':'none',rnf:activeKind==='rnf'?'both':'none',story:activeKind==='story'?'both':'none',asis:activeKind==='asis'?'both':'none'})
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const file=useRef<HTMLInputElement>(null)
 const choose=(kind:FunctionalKind,value:TransferScope)=>setSelection(old=>({...old,[kind]:value}))
 const exportNow=async()=>{setBusy(true);setError('');try{
  const bundle=await exportFunctionalSchemas(projectId,selection)
  downloadJSON('NOVZI_formularios_y_plantillas.json',bundle)
  setMessage('JSON generado. No contiene registros diligenciados ni sus evidencias.')
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const importFile=async(input:File)=>{setBusy(true);setError('');try{
  if(input.size>10000000)throw new Error('El JSON no puede superar 10 MB')
  const data:unknown=JSON.parse(await input.text())
  if(!data||typeof data!=='object'||(data as {format?:string}).format!==TRANSFER_FORMAT)throw new Error('Selecciona un JSON de formularios o plantillas de NOVZI')
  const result=await importFunctionalSchemas(projectId,data)
  await onImported()
  setMessage(`${result.addedFields} campos creados, ${result.reusedFields} reutilizados y ${result.addedTemplates} plantillas importadas. No se reemplazó información existente.`)
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="functional-transfer"><div className="functional-transfer-head"><button className="ghost" onClick={onClose}><ArrowLeft size={15}/> Volver</button><div><h2>Importar y exportar formularios y plantillas</h2><p>Combina los tipos documentales. Una plantilla exportada incluye las definiciones de los campos que utiliza para poder importarse de manera independiente.</p></div></div>
  <div className="functional-transfer-card"><h3>Exportar a JSON</h3><p>Selecciona qué compartir de cada tipo. Los registros y datos diligenciados no se incluyen.</p>
   {FUNCTIONAL_KINDS.map(kind=><label className="functional-transfer-option" key={kind}><strong>{KIND_LABELS[kind]}</strong><select aria-label={`Exportación de ${KIND_LABELS[kind]}`} value={selection[kind]} onChange={e=>choose(kind,e.target.value as TransferScope)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
   <button className="primary" disabled={!canExport||busy||Object.values(selection).every(v=>v==='none')} onClick={()=>void exportNow()}><Download size={16}/> Descargar JSON combinado</button>
  </div>
  <div className="functional-transfer-card"><h3>Importar un JSON de NOVZI</h3><p>NOVZI valida y crea los campos necesarios para cada plantilla. Reutiliza campos compatibles y conserva los documentos y las plantillas actuales.</p>
   <input ref={file} type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f)}}/>
   <button className="ghost" disabled={busy||(!canFields&&!canTemplates)} onClick={()=>file.current?.click()}><Upload size={16}/> Elegir archivo JSON</button>
   {(!canFields||!canTemplates)&&<small>La API comprobará los permisos requeridos según el contenido del archivo (formularios o plantillas).</small>}
  </div>
  <p className="functional-transfer-hint"><FileJson size={17}/> Formato versionado NOVZI · Portabilidad entre proyectos sin sobrescrituras.</p>
  {error&&<p className="functional-error" role="alert">{error}</p>}{message&&<p className="functional-success" role="status">{message}</p>}
 </section>
}
