import {test} from 'vitest'
import assert from 'node:assert/strict'
import {request,setCsrf} from './http'
const originalFetch=globalThis.fetch
const restore=()=>{globalThis.fetch=originalFetch;setCsrf('')}
test('cliente HTTP: GET envía cookies y no envía CSRF',async()=>{
 try{
  let capture:RequestInit|undefined
  globalThis.fetch=async(_url,options)=>{capture=options;return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})}
  setCsrf('token')
  const result=await request<{ok:boolean}>('/projects')
  assert.equal(result.ok,true)
  assert.equal(capture?.credentials,'include')
  assert.equal(capture?.cache,'no-store')
  assert.equal((capture?.headers as Record<string,string>)['X-CSRF-Token'],undefined)
 }finally{restore()}
})
test('cliente HTTP: POST y PUT envían token CSRF y cuerpo de petición',async()=>{
 try{
  for(const method of ['POST','PUT','PATCH','DELETE']){
   let capture:RequestInit|undefined
   globalThis.fetch=async(_url,options)=>{capture=options;return new Response(JSON.stringify({ok:true}),{status:200})}
   setCsrf('csrf-test')
   await request('/test',{method,body:JSON.stringify({name:'ATLAS'})})
   assert.equal((capture?.headers as Record<string,string>)['X-CSRF-Token'],'csrf-test')
   assert.equal(capture?.body,JSON.stringify({name:'ATLAS'}))
   assert.equal((capture?.headers as Record<string,string>)['Content-Type'],'application/json')
  }
 }finally{restore()}
})
test('cliente HTTP: errores 403 / 409 se propagan con mensaje del backend',async()=>{
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Permiso requerido: artifact.export'}),{status:403})
  await assert.rejects(()=>request('/projects'),/artifact.export/)
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Conflicto de guardado'}),{status:409})
  await assert.rejects(()=>request('/projects'),/Conflicto/)
 }finally{restore()}
})
test('cliente HTTP: error de red no se interpreta como autenticación fallida',async()=>{
 try{
  globalThis.fetch=async()=>{throw new Error('ECONNREFUSED')}
  await assert.rejects(()=>request('/projects'),/API no disponible/)
 }finally{restore()}
})

test('cliente HTTP: respuesta vacía, error sin mensaje y métodos seguros no envían CSRF',async()=>{
 try{
  const captures:RequestInit[]=[]
  globalThis.fetch=async(_url,options)=>{captures.push(options||{});return new Response('No es JSON',{status:200})}
  setCsrf('qa-csrf-token')
  for(const method of ['HEAD','OPTIONS'])await request('/health',{method})
  for(const options of captures)assert.equal((options.headers as Record<string,string>)['X-CSRF-Token'],undefined)
  assert.equal(captures.length,2)
  globalThis.fetch=async()=>new Response('No es JSON',{status:503})
  await assert.rejects(()=>request('/health'),/Error HTTP 503/)
 }finally{restore()}
})


test('cliente HTTP: DELETE sin cuerpo omite Content-Type y conserva CSRF',async()=>{
 try{
  let capture:RequestInit|undefined
  globalThis.fetch=async(_url,options)=>{capture=options;return new Response(JSON.stringify({ok:true}),{status:200})}
  setCsrf('csrf-test')
  await request('/workspaces/w1',{method:'DELETE'})
  assert.equal(capture?.method,'DELETE')
  assert.equal(capture?.body,undefined)
  assert.equal((capture?.headers as Record<string,string>)['Content-Type'],undefined)
  assert.equal((capture?.headers as Record<string,string>)['X-CSRF-Token'],'csrf-test')
 }finally{restore()}
})
test('cliente HTTP: POST sin cuerpo omite Content-Type y conserva CSRF',async()=>{
 try{
  let capture:RequestInit|undefined
  globalThis.fetch=async(_url,options)=>{capture=options;return new Response(JSON.stringify({ok:true}),{status:200})}
  setCsrf('csrf-test')
  await request('/auth/logout',{method:'POST'})
  assert.equal((capture?.headers as Record<string,string>)['Content-Type'],undefined)
  assert.equal((capture?.headers as Record<string,string>)['X-CSRF-Token'],'csrf-test')
 }finally{restore()}
})

// Regression: a legacy caller may explicitly set JSON despite sending no body.
test('cliente HTTP: elimina Content-Type heredado en DELETE sin cuerpo',async()=>{
 try{
  let capture:RequestInit|undefined
  globalThis.fetch=async(_url,options)=>{capture=options;return new Response(JSON.stringify({ok:true}),{status:200})}
  setCsrf('csrf-test')
  await request('/projects/p1',{method:'DELETE',headers:{'Content-Type':'application/json'}})
  assert.equal((capture?.headers as Record<string,string>)['Content-Type'],undefined)
  assert.equal((capture?.headers as Record<string,string>)['X-CSRF-Token'],'csrf-test')
 }finally{restore()}
})
