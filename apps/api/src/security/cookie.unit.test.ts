import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {FastifyRequest} from 'fastify'
import {env} from '../config/env'
import {readCookie,csrfFor,secureCookie} from './identity'
const fake=(cookie:string)=>({headers:{cookie}} as FastifyRequest)
test('cookie ATLAS incluye HttpOnly, SameSite Lax y ruta limitada a la API',()=>{
 const cookie=secureCookie('token-test')
 assert.match(cookie,/^atlas_session=token-test/)
 assert.match(cookie,/HttpOnly/)
 assert.match(cookie,/SameSite=Lax/)
 assert.match(cookie,/Path=\/api\/v1/)
 assert.equal(cookie.includes('Secure'),env.secureCookies)
})
test('logout elimina la cookie con Max-Age 0',()=>{
 const cookie=secureCookie('',true)
 assert.match(cookie,/Max-Age=0/)
})
test('cookie se decodifica; cookies extras y valor malformado no rompen la API',()=>{
 assert.equal(readCookie(fake('other=12; atlas_session=TOKEN_123; csrf=ok')),'TOKEN_123')
 assert.equal(readCookie(fake('other=12')),'')
 assert.equal(readCookie(fake('atlas_session=%ZZ')),'')
})
test('CSRF depende de sesión y secreto, y es estable para el mismo token',()=>{
 assert.equal(csrfFor('sesion-A'),csrfFor('sesion-A'))
 assert.notEqual(csrfFor('sesion-A'),csrfFor('sesion-B'))
})
