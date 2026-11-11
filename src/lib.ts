import {createClient} from '@supabase/supabase-js'
import type {ProjectDocument,Project,Workspace} from './types'
const url=import.meta.env.VITE_SUPABASE_URL?.trim()
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const cloudEnabled=!!(url&&key)
export const supabase=cloudEnabled?createClient(url!,key!):null
const KEY='atlas:v3:'
export function readDemo<T>(key:string, fallback:T):T {try {const v=localStorage.getItem(KEY+key);return v?JSON.parse(v) as T:fallback}catch{return fallback}}
export function writeDemo<T>(key:string,value:T){localStorage.setItem(KEY+key,JSON.stringify(value))}
export async function listWorkspaces(uid:string):Promise<Workspace[]>{
 if(!supabase)return readDemo<Workspace[]>('workspaces',[{id:'demo-ws',name:'Zercano · DEMO',role:'owner',demo:true},{id:'personal-ws',name:'Mi espacio personal',role:'owner',demo:true}])
 const {data,error}=await supabase.from('workspaces').select('id,name,created_by').order('created_at',{ascending:true});if(error)throw error
 const ws=data||[];if(!ws.length)return []
 const {data:members,error:memberError}=await supabase.from('workspace_members').select('workspace_id,role').eq('user_id',uid)
 if(memberError)throw memberError
 return ws.map(w=>({...w,role:(members?.find(m=>m.workspace_id===w.id)?.role||'viewer') as Workspace['role']}))
}
export async function createWorkspace(name:string):Promise<string>{
 if(!supabase){const id=crypto.randomUUID();const ws=await listWorkspaces('');writeDemo('workspaces',[...ws,{id,name,role:'owner',demo:true}]);return id}
 const {data,error}=await supabase.rpc('atlas_create_workspace',{p_name:name});if(error)throw error;return data as string
}
export async function listProjects(workspaceId:string):Promise<Project[]>{
 if(!supabase){const fallback=workspaceId==='demo-ws'?[{id:'demo-project',workspace_id:workspaceId,name:'Zercano · Plataforma',description:'Ecosistema ficticio de demostración'}]:[];return readDemo<Project[]>('projects:'+workspaceId,fallback)}
 const {data,error}=await supabase.from('projects').select('id,workspace_id,name,description').eq('workspace_id',workspaceId).order('created_at',{ascending:true});if(error)throw error;return data as Project[]
}
export async function createProject(workspaceId:string,name:string,document:ProjectDocument):Promise<Project>{
 if(!supabase){const p={id:crypto.randomUUID(),workspace_id:workspaceId,name,description:''};const ps=await listProjects(workspaceId);writeDemo('projects:'+workspaceId,[...ps,p]);writeDemo('doc:'+p.id,{document,version:1});return p}
 const {data,error}=await supabase.from('projects').insert({workspace_id:workspaceId,name}).select('id,workspace_id,name,description').single();if(error)throw error
 const {error:e2}=await supabase.from('project_documents').insert({project_id:data.id,document,version:1});if(e2)throw e2
 return data as Project
}
export async function loadDocument(projectId:string):Promise<{document:ProjectDocument,version:number}|null>{
 if(!supabase)return readDemo<{document:ProjectDocument,version:number}|null>('doc:'+projectId,null)
 const {data,error}=await supabase.from('project_documents').select('document,version').eq('project_id',projectId).maybeSingle();if(error)throw error;return data as {document:ProjectDocument,version:number}|null
}
export async function saveDocument(projectId:string,document:ProjectDocument,expectedVersion:number):Promise<number>{
 if(!supabase){const next=expectedVersion+1;writeDemo('doc:'+projectId,{document,version:next});return next}
 const {data,error}=await supabase.rpc('atlas_save_document',{p_project:projectId,p_document:document,p_expected_version:expectedVersion});if(error)throw error;return data as number
}
export async function createInvite(workspaceId:string,role:'editor'|'viewer'|'admin'):Promise<string>{
 if(!supabase)throw Error('Las invitaciones reales requieren Supabase.')
 const {data,error}=await supabase.rpc('atlas_create_invite',{p_workspace:workspaceId,p_role:role});if(error)throw error;return data as string
}
export async function redeemInvite(token:string):Promise<void>{
 if(!supabase)throw Error('Conecta Supabase para aceptar invitaciones.')
 const {error}=await supabase.rpc('atlas_redeem_invite',{p_token:token});if(error)throw error
}
