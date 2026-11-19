import {request} from '../../shared/api/http'
export interface Organization{id:string;name:string;role:'owner'|'admin'|'member';created_by:string;workspace_count:number}
export interface OrganizationMember{id:string;name:string;email:string;role:'owner'|'admin'|'member'}
export interface OrganizationInvitation{id:string;organization_id:string;organization_name:string;email:string;role:'admin'|'member';expires_at:string}
export const listOrganizations=()=>request<Organization[]>('/organizations')
export const createOrganization=(name:string)=>request<{id:string}>('/organizations',{method:'POST',body:JSON.stringify({name})})
export const organizationMembers=(id:string,query='')=>request<OrganizationMember[]>(`/organizations/${encodeURIComponent(id)}/members?q=${encodeURIComponent(query)}`)
export const organizationWorkspaces=(id:string)=>request<Array<{id:string;name:string;organization_id:string}>>(`/organizations/${encodeURIComponent(id)}/workspaces`)
export const createOrganizationWorkspace=async(organizationId:string,name:string)=>{
 const created=await request<{id:string}>(`/organizations/${encodeURIComponent(organizationId)}/workspaces`,{method:'POST',body:JSON.stringify({name})})
 return created.id
}
export const createOrganizationUser=(id:string,form:{name:string;email:string;password:string;role:'admin'|'member'})=>request(`/organizations/${encodeURIComponent(id)}/users`,{method:'POST',body:JSON.stringify(form)})
export const inviteToOrganization=(id:string,email:string,role:'admin'|'member')=>request(`/organizations/${encodeURIComponent(id)}/invitations`,{method:'POST',body:JSON.stringify({email,role})})
export interface OrganizationOutgoingInvitation{id:string;email:string;role:'admin'|'member';created_at:string;expires_at:string}
export const listOrganizationInvitations=(id:string)=>request<OrganizationOutgoingInvitation[]>(`/organizations/${encodeURIComponent(id)}/invitations`)
export const cancelOrganizationInvitation=(organizationId:string,invitationId:string)=>request(`/organizations/${encodeURIComponent(organizationId)}/invitations/${encodeURIComponent(invitationId)}`,{method:'DELETE'})
export const myOrganizationInvitations=()=>request<OrganizationInvitation[]>('/organizations/invitations/mine')
export const acceptOrganizationInvitation=(id:string)=>request<{ok:boolean;organizationId:string}>(`/organizations/invitations/${encodeURIComponent(id)}/accept`,{method:'POST'})
export const declineOrganizationInvitation=(id:string)=>request(`/organizations/invitations/${encodeURIComponent(id)}/decline`,{method:'POST'})

export const updateOrganizationMember=(organizationId:string,userId:string,role:'admin'|'member')=>request(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,{method:'PATCH',body:JSON.stringify({role})})
export const removeOrganizationMember=(organizationId:string,userId:string)=>request(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`,{method:'DELETE'})

// Único punto administrativo para asignaciones jerárquicas.
export type AccessRole={id:string;name:string;role_key:string;workspace_id:string}
export type AccessDiagram={id:string;name:string;type:string}
export type AccessProject={id:string;name:string;diagrams:AccessDiagram[]}
export type AccessSpace={id:string;name:string;roles:AccessRole[];projects:AccessProject[]}
export type OrgGrant={workspace_id:string;project_id?:string;role_id:string;role_name:string;role_key:string;diagram_scope?:'all'|'selected';diagram_ids?:string[]}
export const organizationAccessTree=(id:string)=>request<AccessSpace[]>(`/organizations/${encodeURIComponent(id)}/access-tree`)
export const organizationMemberGrants=(id:string,userId:string)=>request<{workspaces:OrgGrant[];projects:OrgGrant[]}>(`/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/grants`)
export const assignOrganizationGrants=(id:string,userId:string,form:{workspaceId:string;workspaceRoleId?:string;projectId?:string;projectRoleId?:string;diagramIds?:string[]})=>request<{ok:boolean}>(`/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/grants`,{method:'PUT',body:JSON.stringify(form)})
export const removeOrganizationGrant=(id:string,userId:string,workspaceId:string,projectId?:string)=>request<{ok:boolean}>(`/organizations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}/grants`,{method:'DELETE',body:JSON.stringify({workspaceId,projectId})})

export type OrganizationAccessRole={id:string;name:string;role_key:string;permissions:string[]}
export const organizationRoles=(organizationId:string,workspaceId:string)=>request<OrganizationAccessRole[]>(`/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/roles`)
export const organizationCreateRole=(organizationId:string,workspaceId:string,form:{name:string;roleKey:string;permissions:string[]})=>request(`/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/roles`,{method:'POST',body:JSON.stringify(form)})
export const organizationUpdateRole=(organizationId:string,workspaceId:string,roleId:string,permissions:string[])=>request(`/organizations/${encodeURIComponent(organizationId)}/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`,{method:'PUT',body:JSON.stringify({permissions})})
