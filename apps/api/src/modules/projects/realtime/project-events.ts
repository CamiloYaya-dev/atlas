import type {ServerResponse} from 'node:http'

export interface LiveParticipant {
 clientId:string
 userId:string
 name:string
 diagramId:string|null
 elementId:string|null
}
interface Connection extends LiveParticipant {
 response:ServerResponse
 heartbeat:ReturnType<typeof setInterval>
 lastSeen:number
 visibility?:{diagrams:Set<string>;elements:Set<string>}
}

/** In-process SSE hub for the single API instance used by the local pilot.
 * Sends only version numbers and presence; actual documents are fetched again
 * through authenticated, permission-filtered REST endpoints. */
export class ProjectEvents {
 private readonly projects=new Map<string,Map<string,Connection>>()
 private send(connection:Connection,event:string,payload:unknown){
  if(!connection.response.destroyed)connection.response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
 }
 private presence(projectId:string){
  const clients=this.projects.get(projectId)
  if(!clients)return
  // "En línea" means UNIQUE PEOPLE, not open tabs or stale SSE sockets.
  // Prefer a recent focused tab for each person (otherwise their last tab).
  const people=new Map<string,Connection>()
  for(const client of clients.values()){
   const previous=people.get(client.userId)
   if(!previous||Boolean(client.diagramId)&&!previous.diagramId||client.lastSeen>previous.lastSeen)people.set(client.userId,client)
  }
  const active=[...people.values()].map(({userId,clientId,name,diagramId,elementId}):LiveParticipant=>({userId,clientId,name,diagramId,elementId}))
  for(const client of clients.values())this.send(client,'presence',{participants:active.map(p=>{
   const canSeeDiagram=!client.visibility||!p.diagramId||client.visibility.diagrams.has(p.diagramId)
   const canSeeElement=canSeeDiagram&&(!client.visibility||!p.elementId||client.visibility.elements.has(p.elementId))
   return {...p,diagramId:canSeeDiagram?p.diagramId:null,elementId:canSeeElement?p.elementId:null}
  })})
 }
 subscribe(projectId:string,clientId:string,userId:string,name:string,response:ServerResponse,version:number,validate:()=>Promise<void>,visibility?:{diagrams:Set<string>;elements:Set<string>}){
  let clients=this.projects.get(projectId)
  if(!clients){clients=new Map();this.projects.set(projectId,clients)}
  const existing=clients.get(clientId)
  if(!existing&&(clients.size>=50||[...clients.values()].filter(c=>c.userId===userId).length>=5)){response.end();return}
  if(existing){existing.response.end();this.remove(projectId,clientId,existing.response)}
  // remove() can delete an empty project map; re-register it.
  clients=this.projects.get(projectId)||new Map<string,Connection>()
  this.projects.set(projectId,clients)
  const heartbeat=setInterval(()=>{
   if(response.destroyed)return
   // Tab suspended, browser terminated or lost network: expire presence.
   if(Date.now()-(this.projects.get(projectId)?.get(clientId)?.lastSeen||0)>65000){response.end();this.remove(projectId,clientId,response);return}
   void validate().then(()=>{if(!response.destroyed)response.write(': heartbeat\n\n')}).catch(()=>response.end())
  },15000)
  const connection:Connection={clientId,userId,name,diagramId:null,elementId:null,response,heartbeat,visibility,lastSeen:Date.now()}
  clients.set(clientId,connection)
  response.on('close',()=>this.remove(projectId,clientId,response))
  this.send(connection,'version',{version})
  this.presence(projectId)
 }
 updateVisibility(projectId:string,clientId:string,diagrams:Set<string>,elements:Set<string>){
  const client=this.projects.get(projectId)?.get(clientId)
  if(!client)return
  client.visibility={diagrams,elements}
  if(client.diagramId&&!diagrams.has(client.diagramId)){client.diagramId=null;client.elementId=null}
  if(client.elementId&&!elements.has(client.elementId))client.elementId=null
  this.presence(projectId)
 }
 /** Revoke the SSE connection immediately when project access is removed. */
 revokeUser(projectId:string,userId:string){
  for(const connection of [...(this.projects.get(projectId)?.values()||[])]){
   if(connection.userId===userId){connection.response.end();this.remove(projectId,connection.clientId,connection.response)}
  }
 }
 updatePresence(projectId:string,clientId:string,userId:string,diagramId:string|null,elementId:string|null){
  const client=this.projects.get(projectId)?.get(clientId)
  if(!client||client.userId!==userId)return
  client.lastSeen=Date.now()
  client.diagramId=diagramId
  client.elementId=elementId
  this.presence(projectId)
 }
 /** A connected other identity is a reason to stage a destructive restoration, not apply it immediately. */
 hasOtherParticipants(projectId:string,userId:string){
  return [...(this.projects.get(projectId)?.values()||[])].some(c=>!c.response.destroyed&&c.userId!==userId&&Date.now()-c.lastSeen<65000)
 }
 publishVersion(projectId:string,version:number){
  for(const client of this.projects.get(projectId)?.values()||[])this.send(client,'version',{version})
 }
 private remove(projectId:string,clientId:string,response?:ServerResponse){
  const clients=this.projects.get(projectId),existing=clients?.get(clientId)
  if(!clients||!existing||(response&&existing.response!==response))return
  clearInterval(existing.heartbeat)
  clients.delete(clientId)
  if(!clients.size)this.projects.delete(projectId)
  else this.presence(projectId)
 }
 closeAll(){
  for(const clients of this.projects.values())for(const client of clients.values()){
   clearInterval(client.heartbeat)
   client.response.end()
  }
  this.projects.clear()
 }
}
export const projectEvents=new ProjectEvents()
