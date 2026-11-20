import {test} from 'node:test'
import assert from 'node:assert/strict'
import {projectSseHeaders} from './sse-headers'

const allowed=['https://app.novzi.co','http://localhost:5173']
test('SSE: permite explícitamente el frontend productivo con credenciales',()=>{
 const headers=projectSseHeaders('https://app.novzi.co',allowed)
 assert.equal(headers['Access-Control-Allow-Origin'],'https://app.novzi.co')
 assert.equal(headers['Access-Control-Allow-Credentials'],'true')
 assert.equal(headers['Content-Type'],'text/event-stream; charset=utf-8')
 assert.equal(headers['X-Accel-Buffering'],'no')
 assert.equal(headers['Cache-Control'],'no-store, no-transform')
 assert.equal(headers['Vary'],'Origin')
})
test('SSE: permite el origen local expresamente configurado',()=>{
 assert.equal(projectSseHeaders('http://localhost:5173',allowed)['Access-Control-Allow-Origin'],'http://localhost:5173')
})
test('SSE: un origen externo no se refleja ni se acepta',()=>{
 assert.throws(()=>projectSseHeaders('https://atacante.example',allowed),e=>e instanceof Error && 'statusCode' in e && e.statusCode===403)
})
test('SSE: peticiones sin Origin mantienen acceso de servidor a servidor sin cabeceras permisivas',()=>{
 const headers=projectSseHeaders(undefined,allowed)
 assert.equal(headers['Access-Control-Allow-Origin'],undefined)
 assert.equal(headers['Access-Control-Allow-Credentials'],undefined)
})
