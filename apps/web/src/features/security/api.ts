import {request,setCsrf} from '../../shared/api/http'
import type {WorkspaceAccess} from './types'
export type CurrentAccount={id:string;email:string;name:string;platformAdmin:boolean}
type AuthResponse={user:CurrentAccount;csrfToken:string}
export async function session(){
 const data=await request<AuthResponse>('/auth/me');setCsrf(data.csrfToken);return data.user
}
export async function login(email:string,password:string){
 const data=await request<AuthResponse>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setCsrf(data.csrfToken);return data.user
}
export async function logout(){await request('/auth/logout',{method:'POST'});setCsrf('')}
export const workspaceAccess=(id:string)=>request<WorkspaceAccess>(`/workspaces/${id}/access`)
export const workspaceRoles=(id:string)=>request<RoleDetails[]>(`/workspaces/${id}/roles`)
export const workspaceMembers=(id:string)=>request<Member[]>(`/workspaces/${id}/members`)
export const usersList=()=>request<UserAccount[]>('/admin/users')
export const createUser=(data:{email:string;name:string;password:string})=>request<{id:string}>('/admin/users',{method:'POST',body:JSON.stringify(data)})
export const setUserActive=(id:string,active:boolean)=>request(`/admin/users/${id}`,{method:'PATCH',body:JSON.stringify({active})})
export const createRole=(id:string,data:{roleKey:string;name:string;permissions:string[]})=>request(`/workspaces/${id}/roles`,{method:'POST',body:JSON.stringify(data)})
export const updateRole=(wid:string,rid:string,permissions:string[])=>request(`/workspaces/${wid}/roles/${rid}`,{method:'PUT',body:JSON.stringify({permissions})})
export const assignMember=(wid:string,userId:string,roleId:string)=>request(`/workspaces/${wid}/members`,{method:'POST',body:JSON.stringify({userId,roleId})})
export const removeMember=(wid:string,userId:string)=>request(`/workspaces/${wid}/members/${userId}`,{method:'DELETE'})
export interface UserAccount{id:string;email:string;name:string;active:boolean;platform_admin:boolean}
export interface RoleDetails{id:string;role_key:string;name:string;system_role:boolean;permissions:string[]}
export interface Member{id:string;email:string;name:string;active:boolean;role_id:string;role_key:string;role_name:string}
