import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import type {ServerResponse} from 'node:http'
import {ProjectEvents} from './project-events'
class FakeResponse extends EventEmitter {
 destroyed=false
 chunks:string[]=[]
 write(data:string){this.chunks.push(data);return true}
 end(){this.destroyed=true;this.emit('close')}
 content(){return this.chunks.join('')}
}
const asResponse=(fake:FakeResponse)=>fake as unknown as ServerResponse

test('colaboración en vivo: envía versión inicial, participantes y versiones nuevas solo al proyecto suscrito',()=>{
 const events=new ProjectEvents(),a=new FakeResponse(),b=new FakeResponse(),outsider=new FakeResponse()
 const validate=async()=>{}
 events.subscribe('p','aaaaaaaa-0000-0000-0000-000000000001','u-a','Persona A',asResponse(a),2,validate)
 events.subscribe('p','bbbbbbbb-0000-0000-0000-000000000002','u-b','Persona B',asResponse(b),2,validate)
 events.subscribe('otro','cccccccc-0000-0000-0000-000000000003','u-c','Persona C',asResponse(outsider),1,validate)
 assert.match(a.content(),/event: version/)
 assert.match(b.content(),/Persona A/)
 assert.doesNotMatch(outsider.content(),/Persona A/)
 events.publishVersion('p',3)
 assert.match(a.content(),/"version":3/)
 assert.match(b.content(),/"version":3/)
 assert.doesNotMatch(outsider.content(),/"version":3/)
 events.closeAll()
 assert.equal(a.destroyed,true)
 assert.equal(b.destroyed,true)
})
test('colaboración en vivo: no permite suplantar la presencia con otro usuario',()=>{
 const events=new ProjectEvents(),r=new FakeResponse()
 events.subscribe('proyecto','cccccccc-0000-0000-0000-000000000004','u-a','Persona A',asResponse(r),1,async()=>{})
 events.updatePresence('proyecto','cccccccc-0000-0000-0000-000000000004','u-b','secreto','elemento-secreto')
 assert.doesNotMatch(r.content(),/secreto/)
 events.updatePresence('proyecto','cccccccc-0000-0000-0000-000000000004','u-a','c1','elemento-visible')
 assert.match(r.content(),/elemento-visible/)
 r.end()
 events.closeAll()
})

test('presencia no revela identificadores de diagramas o elementos sin permiso al receptor',()=>{
 const hub=new ProjectEvents(),owner=new FakeResponse(),viewer=new FakeResponse()
 hub.subscribe('workspace','aaaaaaaa-0000-0000-0000-000000000001','owner','Propietario',asResponse(owner),1,async()=>{})
 hub.subscribe('workspace','bbbbbbbb-0000-0000-0000-000000000002','viewer','Lector',asResponse(viewer),1,async()=>{},
  {diagrams:new Set(['d-public']),elements:new Set(['e-public'])})
 hub.updatePresence('workspace','aaaaaaaa-0000-0000-0000-000000000001','owner','d-secret','e-secret')
 assert.match(owner.content(),/d-secret/)
 assert.doesNotMatch(viewer.content(),/d-secret|e-secret/)
 hub.updatePresence('workspace','aaaaaaaa-0000-0000-0000-000000000001','owner','d-public','e-public')
 assert.match(viewer.content(),/e-public/)
 hub.closeAll()
})

test('presencia real: varias pestañas de una persona cuentan una sola vez y se retiran al cerrar',()=>{
 const hub=new ProjectEvents(),a=new FakeResponse(),b=new FakeResponse(),c=new FakeResponse()
 hub.subscribe('p','aaaaaaaa-0000-0000-0000-000000000001','u-1','Persona Uno',asResponse(a),1,async()=>{})
 hub.subscribe('p','bbbbbbbb-0000-0000-0000-000000000002','u-1','Persona Uno',asResponse(b),1,async()=>{})
 hub.subscribe('p','cccccccc-0000-0000-0000-000000000003','u-2','Persona Dos',asResponse(c),1,async()=>{})
 const frames=c.content().split('event: presence\ndata: ').filter(Boolean)
 const last=JSON.parse(frames[frames.length-1].split('\n')[0]) as {participants:{userId:string}[]}
 assert.deepEqual(last.participants.map(p=>p.userId).sort(),['u-1','u-2'])
 b.end();c.end()
 const after=a.content().split('event: presence\ndata: ').filter(Boolean)
 const current=JSON.parse(after[after.length-1].split('\n')[0]) as {participants:{userId:string}[]}
 assert.deepEqual(current.participants.map(p=>p.userId),['u-1'])
 hub.closeAll()
})

test('restauración: detecta otros usuarios conectados pero no otras pestañas del propietario',()=>{
 const hub=new ProjectEvents(),owner=new FakeResponse(),tab=new FakeResponse(),other=new FakeResponse()
 hub.subscribe('p','aaaaaaaa-0000-0000-0000-000000000001','owner','Propietario',asResponse(owner),1,async()=>{})
 assert.equal(hub.hasOtherParticipants('p','owner'),false)
 hub.subscribe('p','bbbbbbbb-0000-0000-0000-000000000002','owner','Otra pestaña',asResponse(tab),1,async()=>{})
 assert.equal(hub.hasOtherParticipants('p','owner'),false)
 hub.subscribe('p','cccccccc-0000-0000-0000-000000000003','collaborator','Colaborador',asResponse(other),1,async()=>{})
 assert.equal(hub.hasOtherParticipants('p','owner'),true)
 other.end()
 assert.equal(hub.hasOtherParticipants('p','owner'),false)
 hub.closeAll()
})

test('revocar y actualizar visibilidad elimina focos privados y desconecta solo al usuario afectado',()=>{
 const hub=new ProjectEvents(),a=new FakeResponse(),b=new FakeResponse()
 try{
  hub.subscribe('p','a','owner','Owner',asResponse(a),1,async()=>{})
  hub.subscribe('p','b','reader','Reader',asResponse(b),1,async()=>{})
  hub.updatePresence('p','b','reader','d','e')
  hub.updateVisibility('p','b',new Set(['d']),new Set())
  const last=()=>JSON.parse(a.chunks.filter(x=>x.startsWith('event: presence')).at(-1)!.split('\n')[1].slice(6)).participants.find((p:{userId:string})=>p.userId==='reader')
  assert.equal(last().diagramId,'d');assert.equal(last().elementId,null)
  hub.updateVisibility('p','b',new Set(),new Set());assert.equal(last().diagramId,null)
  hub.updateVisibility('p','missing',new Set(),new Set())
  hub.revokeUser('p','reader');assert.equal(b.destroyed,true);assert.equal(a.destroyed,false);assert.equal(hub.hasOtherParticipants('p','owner'),false)
  hub.revokeUser('unknown','reader')
 }finally{hub.closeAll()}
})
test('límite de cinco pestañas por persona y reemplazo del mismo clientId',()=>{
 const hub=new ProjectEvents(),tabs=Array.from({length:6},()=>new FakeResponse()),replacement=new FakeResponse()
 try{
  tabs.forEach((r,i)=>hub.subscribe('p',String(i),'u','QA',asResponse(r),1,async()=>{}))
  assert.equal(tabs[5].destroyed,true)
  hub.subscribe('p','0','u','QA',asResponse(replacement),2,async()=>{})
  assert.equal(tabs[0].destroyed,true);assert.equal(replacement.destroyed,false);assert.match(replacement.content(),/"version":2/)
  hub.publishVersion('p',3);assert.match(replacement.content(),/"version":3/)
 }finally{hub.closeAll()}
})
test('heartbeat valida permisos y expira presencia inactiva',async(t)=>{
 t.mock.timers.enable({apis:['setInterval','Date'],now:100000})
 const hub=new ProjectEvents(),a=new FakeResponse(),b=new FakeResponse();let validates=0
 try{
  hub.subscribe('p','a','owner','Owner',asResponse(a),1,async()=>{validates++})
  hub.subscribe('p','b','reader','Reader',asResponse(b),1,async()=>{throw Error('revocado')})
  t.mock.timers.tick(15000);await Promise.resolve();await Promise.resolve()
  assert.equal(validates,1);assert.match(a.content(),/: heartbeat/);assert.equal(b.destroyed,true)
  t.mock.timers.tick(60000);assert.equal(a.destroyed,true);assert.equal(hub.hasOtherParticipants('p','reader'),false)
 }finally{hub.closeAll();t.mock.timers.reset()}
})
