import {useEffect,useState} from 'react'
import {ShieldCheck,RefreshCw} from 'lucide-react'
import {Overlay} from '../../components/molecules/Overlay'
import {workspaceLicense,setWorkspaceLicense} from '../projects/api'
import type {LicenseEntitlements} from '../projects/api'

/** Frontend only presents the server decision; it never grants capabilities locally. */
export default function LicensePanel({workspaceId,workspaceName,platformAdmin,onClose}:{workspaceId:string;workspaceName:string;platformAdmin:boolean;onClose:()=>void}){
 const [license,setLicense]=useState<LicenseEntitlements|null>(null)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const refresh=async()=>{setError('');try{setLicense(await workspaceLicense(workspaceId))}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void refresh()},[workspaceId])
 const change=async(active:boolean)=>{
  if(!platformAdmin||busy)return
  setBusy(true);setError('');setMessage('')
  try{
   const next=await setWorkspaceLicense(workspaceId,{planCode:active?'pro':'free',status:active?'active':'revoked',features:{}})
   setLicense(next);setMessage(active?'Licencia de prueba PRO activada en el servidor':'Licencia de prueba desactivada; se aplicará la marca de agua')
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <Overlay title="Licencia y suscripción ATLAS" onClose={onClose}>
  <div className="modal-body atlas-license-panel">
   <p className="muted-mini">Organización: <strong>{workspaceName}</strong></p>
   {license?<>
    <div className="atlas-license-status"><ShieldCheck size={20}/><div><strong>{license.licenseActive?'PRO · Licencia activa':'FREE · Sin licencia comercial'}</strong><small>{license.licenseActive?'Exportación de imágenes sin marca de agua':'Exportación PNG/JPG con marca de agua ATLAS'}</small></div></div>
    <div className="atlas-license-features"><strong>Funcionalidades</strong><div>PNG y JPG <b>Disponible</b></div><div>Exportar sin marca de agua <b>{license.features['diagram.export.clean']?'Habilitado':'Restringido'}</b></div><div>Exportación avanzada con campos <b>{license.features['diagram.export.advanced']?'Habilitada':'PRO'}</b></div><div>Firma y auditoría <b>Siempre activas</b></div></div>
    {platformAdmin?<><p className="muted-mini">Modo de validación administrativa: la activación es una concesión de prueba, no constituye una compra o una suscripción facturada. Solo administradores de plataforma pueden modificarla.</p><div className="modal-actions"><button className="ghost" disabled={busy} onClick={()=>void change(false)}>Desactivar licencia</button><button className="primary" disabled={busy} onClick={()=>void change(true)}>Activar PRO de prueba</button></div></>:<p className="muted-mini">Para activar una licencia, contacta a la administración de ATLAS.</p>}
   </>:<p className="muted-mini">Consultando los permisos comerciales en el servidor…</p>}
   {error&&<p className="sec-error" role="alert">{error}</p>}{message&&<p className="atlas-license-ok" role="status">{message}</p>}
   <div className="modal-actions"><button type="button" className="ghost" onClick={()=>void refresh()}><RefreshCw size={14}/> Actualizar</button><button type="button" className="ghost" onClick={onClose}>Cerrar</button></div>
  </div>
 </Overlay>
}
