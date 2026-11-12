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
