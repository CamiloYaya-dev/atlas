import {request} from '../../shared/api/http'
export interface AuditEvent {id:string;event_type:string;actor_name:string;actor_email:string|null;resource_id:string|null;resource_name?:string|null;detail:Record<string,unknown>;created_at:string}
export interface AuditPage {items:AuditEvent[];nextCursor:string|null}
export const listAuditEvents=(workspaceId:string,limit=30,beforeId?:string)=>request<AuditPage>(`/workspaces/${encodeURIComponent(workspaceId)}/audit?limit=${limit}${beforeId?`&beforeId=${encodeURIComponent(beforeId)}`:''}`)
