import {request} from '../../shared/api/http'
import type {Workspace} from '@atlas/contracts'
export const listWorkspaces=(_uid:string)=>request<Workspace[]>('/workspaces')
export async function createWorkspace(name:string){const r=await request<{id:string}>('/workspaces',{method:'POST',body:JSON.stringify({name})});return r.id}

export const renameWorkspace=(id:string,name:string)=>request<{id:string;name:string}>(`/workspaces/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({name})})
export const deleteWorkspace=(id:string)=>request<{ok:boolean}>(`/workspaces/${encodeURIComponent(id)}`,{method:'DELETE'})
