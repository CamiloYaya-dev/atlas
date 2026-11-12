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
