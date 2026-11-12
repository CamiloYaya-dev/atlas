import {request} from '../../shared/api/http'
export interface AuditEvent {id:string;event_type:string;actor_name:string;actor_email:string|null;resource_id:string|null;resource_name?:string|null;detail:Record<string,unknown>;created_at:string}
export interface AuditPage {items:AuditEvent[];nextCursor:string|null}
export interface AuditFilters {eventType?:string;actor?:string;projectId?:string;from?:string;to?:string}
export const listAuditEvents=(workspaceId:string,limit=25,beforeId?:string,filters:AuditFilters={})=>{
 const query=new URLSearchParams({limit:String(limit)})
 if(beforeId)query.set('beforeId',beforeId)
 for(const [key,value] of Object.entries(filters))if(value)query.set(key,value)
 return request<AuditPage>(`/workspaces/${encodeURIComponent(workspaceId)}/audit?${query.toString()}`)
}
