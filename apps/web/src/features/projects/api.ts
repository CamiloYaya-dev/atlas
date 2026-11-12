import {request} from '../../shared/api/http'
import type {ProjectDocument,Project} from '@atlas/contracts'
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
export interface LiveParticipant {clientId:string;name:string;diagramId:string|null;elementId:string|null}
export interface LivePresence {participants:LiveParticipant[]}
export const sendPresence=(projectId:string,clientId:string,diagramId:string|null,elementId:string|null)=>request<{ok:boolean}>(`/projects/${encodeURIComponent(projectId)}/presence`,{method:'POST',body:JSON.stringify({clientId,diagramId,elementId})})

export const exportProject=(projectId:string)=>request<{format:string;exportedAt:string;document:ProjectDocument}>(`/projects/${encodeURIComponent(projectId)}/export`)
export async function importProject(projectId:string,document:ProjectDocument,expectedVersion:number){const r=await request<{version:number}>(`/projects/${encodeURIComponent(projectId)}/import`,{method:'POST',body:JSON.stringify({document,expectedVersion})});return r.version}
export type DocumentVersion={version:number;created_at:string;updated_by:string;editor_name:string|null}
export type DocumentVersionSnapshot=DocumentVersion&{document:ProjectDocument}
export const listDocumentVersions=(projectId:string)=>request<DocumentVersion[]>(`/projects/${encodeURIComponent(projectId)}/versions`)
export const loadDocumentVersion=(projectId:string,version:number)=>request<DocumentVersionSnapshot>(`/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(version)}`)
