import {request} from '../../shared/api/http'
import type {Workspace} from '@atlas/contracts'
export const listWorkspaces=(_uid:string)=>request<Workspace[]>('/workspaces')
export async function createWorkspace(name:string){const r=await request<{id:string}>('/workspaces',{method:'POST',body:JSON.stringify({name})});return r.id}
