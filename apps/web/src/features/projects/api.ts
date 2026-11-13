import {request,requestFile} from '../../shared/api/http'
import type {ProjectDocument,Project,AdvancedExportRequest} from '@atlas/contracts'
export const listProjects=(workspaceId:string)=>request<Project[]>(`/workspaces/${encodeURIComponent(workspaceId)}/projects`)
export const createProject=(workspaceId:string,name:string,document:ProjectDocument)=>request<Project>(`/workspaces/${encodeURIComponent(workspaceId)}/projects`,{method:'POST',body:JSON.stringify({name,document})})
export const loadDocument=(projectId:string)=>request<{document:ProjectDocument,version:number}|null>(`/projects/${encodeURIComponent(projectId)}/document`)
/** Collaborative saves use the immutable baseline in PostgreSQL to merge independent edits.
 * The optional callback receives the permission-filtered, canonical document after commit. */
export async function saveDocument(projectId:string,document:ProjectDocument,expectedVersion:number,onCommitted?:(saved:ProjectDocument,version:number)=>void){
 const r=await request<{version:number;document?:ProjectDocument}>(`/projects/${encodeURIComponent(projectId)}/document`,{method:'PUT',body:JSON.stringify({document,expectedVersion,collaborative:true})})
 if(r.document)onCommitted?.(r.document,r.version)
 return r.version
}
export interface LiveParticipant {clientId:string;userId:string;name:string;diagramId:string|null;elementId:string|null}
export interface LivePresence {participants:LiveParticipant[]}
export const sendPresence=(projectId:string,clientId:string,diagramId:string|null,elementId:string|null)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(projectId)}/presence`,{method:'POST',body:JSON.stringify({clientId,diagramId,elementId})})

export const exportProject=(projectId:string)=>request<{format:string;exportedAt:string;document:ProjectDocument}>(`/projects/${encodeURIComponent(projectId)}/export`)
export async function importProject(projectId:string,document:ProjectDocument,expectedVersion:number){const r=await request<{version:number}>(`/projects/${encodeURIComponent(projectId)}/import`,{method:'POST',body:JSON.stringify({document,expectedVersion})});return r.version}
export type DocumentVersion={version:number;created_at:string;updated_by:string;editor_name:string|null}
export type DocumentVersionSnapshot=DocumentVersion&{document:ProjectDocument}
export const listDocumentVersions=(projectId:string)=>request<DocumentVersion[]>(`/projects/${encodeURIComponent(projectId)}/versions`)
export const loadDocumentVersion=(projectId:string,version:number)=>request<DocumentVersionSnapshot>(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(version)}`)

export const renameProject=(projectId:string,name:string)=>request<Project>(`/projects/${encodeURIComponent(projectId)}`,{method:'PATCH',body:JSON.stringify({name})})
/** Restoration creates a new version and will reject an obsolete expectedVersion. */
export const restoreDocumentVersion=(projectId:string,sourceVersion:number,expectedVersion:number)=>request<{version:number;restoredFrom:number}>(`/projects/${encodeURIComponent(projectId)}/restore`,{method:'POST',body:JSON.stringify({sourceVersion,expectedVersion})})

export const projectAccess=(id:string)=>request<import('../security/types').WorkspaceAccess>(`/projects/${encodeURIComponent(id)}/access`)
export const deleteProject=(id:string)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(id)}`,{method:'DELETE'})
export type ProjectMember={id:string;email:string;name:string;role_id:string;role_key:string;role_name:string}
export type ProjectCandidate={id:string;email:string;name:string}
export type ProjectRole={id:string;role_key:string;name:string;permissions:string[]}
export const projectMembers=(id:string)=>request<ProjectMember[]>(`/projects/${encodeURIComponent(id)}/members`)
export const projectCandidates=(id:string)=>request<{users:ProjectCandidate[];roles:ProjectRole[]}>(`/projects/${encodeURIComponent(id)}/candidates`)
export const assignProjectMember=(id:string,userId:string,roleId:string)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,{method:'PUT',body:JSON.stringify({roleId})})
export const removeProjectMember=(id:string,userId:string)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,{method:'DELETE'})

/** Staged restoration: create proposal first; review merges and resolve fields before applying. */
export type RestoreBranch={id:string;source_version:number;base_version:number;created_at:string;status:'open'|'applied'|'discarded';creator_name:string|null}
export type RestoreBranchPreview={id:string;sourceVersion:number;baseVersion:number;currentVersion:number;status:'open'|'applied'|'discarded';conflicts:string[];historicalDiagrams:number;currentDiagrams:number}
export const listRestoreBranches=(projectId:string)=>request<RestoreBranch[]>(`/projects/${encodeURIComponent(projectId)}/restore-branches`)
export const createRestoreBranch=(projectId:string,sourceVersion:number)=>request<RestoreBranch>(`/projects/${encodeURIComponent(projectId)}/restore-branches`,{method:'POST',body:JSON.stringify({sourceVersion})})
export const previewRestoreBranch=(projectId:string,branchId:string)=>request<RestoreBranchPreview>(`/projects/${encodeURIComponent(projectId)}/restore-branches/${encodeURIComponent(branchId)}/preview`)
export const applyRestoreBranch=(projectId:string,branchId:string,expectedVersion:number,mode:'merge'|'replace',resolutions:Record<string,'current'|'historical'>)=>request<{version:number;restoredFrom:number}>(`/projects/${encodeURIComponent(projectId)}/restore-branches/${encodeURIComponent(branchId)}/apply`,{method:'POST',body:JSON.stringify({expectedVersion,mode,resolutions})})
export const discardRestoreBranch=(projectId:string,branchId:string)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(projectId)}/restore-branches/${encodeURIComponent(branchId)}`,{method:'DELETE'})

export interface LicenseEntitlements {
 workspaceId:string
 planCode:'free'|'pro'|'enterprise'
 licenseActive:boolean
 status:string
 features:Record<'diagram.export.png'|'diagram.export.jpg'|'diagram.export.clean'|'diagram.export.advanced',boolean>
 expiresAt:string|null
}
export const workspaceLicense=(workspaceId:string)=>request<LicenseEntitlements>(`/workspaces/${encodeURIComponent(workspaceId)}/license`)
export const setWorkspaceLicense=(workspaceId:string,payload:{planCode:'pro'|'free';status:'active'|'revoked';features:Record<string,boolean>})=>request<LicenseEntitlements>(`/admin/workspaces/${encodeURIComponent(workspaceId)}/license`,{method:'PUT',body:JSON.stringify(payload)})

export const exportDiagramImage=(projectId:string,diagramId:string,format:'png'|'jpg',expectedVersion:number,imageBase64:string,advanced?:AdvancedExportRequest)=>requestFile(`/projects/${encodeURIComponent(projectId)}/diagrams/${encodeURIComponent(diagramId)}/export-image`,{format,expectedVersion,imageBase64,advanced})
