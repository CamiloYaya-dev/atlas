import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import {env} from './config/env'
import {routes} from './http/routes'
import {requireCsrf} from './security/identity'
import {projectEvents} from './modules/projects/realtime/project-events'
/** Testable Fastify composition root. Calling buildApp does not listen on a port. */
export async function buildApp(){
 const app=Fastify({logger:{redact:['req.headers.authorization','req.headers.cookie','req.body.password']},bodyLimit:5*1024*1024,trustProxy:env.trustProxy,requestIdHeader:'x-request-id'})
 await app.register(cors,{origin:(origin,cb)=>cb(null,!origin||env.allowedOrigins.includes(origin)),methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token','X-Request-ID'],credentials:true,maxAge:600})
 await app.register(rateLimit,{global:true,max:100,timeWindow:'1 minute',errorResponseBuilder:()=>({statusCode:429,message:'Demasiadas solicitudes'})})
 // Tolerancia a clientes antiguos: no interpretar un DELETE sin cuerpo como JSON vacío.
 // El hook se ejecuta ANTES del parser, sin alterar la autorización CSRF ni el contenido real.
 app.addHook('onRequest',async req=>{
  if(req.method!=='DELETE'||req.headers['transfer-encoding'])return
  const length=req.headers['content-length']
  const type=req.headers['content-type']
  if((length===undefined||length==='0')&&typeof type==='string'&&/^application\/json(?:\s*;|$)/i.test(type)){
   delete req.headers['content-type']
   delete req.raw.headers['content-type']
  }
 })
 app.addHook('preHandler',async req=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return
  const origin=req.headers.origin
  if(origin&&!env.allowedOrigins.includes(origin))throw Object.assign(new Error('Origen no permitido'),{statusCode:403})
  if(req.url.split('?')[0]==='/api/v1/auth/login')return
  await requireCsrf(req)
 })
 app.addHook('onSend',async(_request,reply,payload)=>{
  reply.header('X-Content-Type-Options','nosniff')
  reply.header('Referrer-Policy','strict-origin-when-cross-origin')
  reply.header('Cache-Control','no-store')
  return payload
 })
 app.setErrorHandler((error,request,reply)=>{
  const status=error!==null&&typeof error==='object'&&'statusCode'in error&&typeof error.statusCode==='number'&&error.statusCode>=400&&error.statusCode<600?error.statusCode:500
  if(status===500)request.log.error({err:error},'Unhandled API error')
  reply.code(status).send({message:status===500?'Error interno del servidor':error instanceof Error?error.message:'Solicitud no válida',statusCode:status,requestId:request.id})
 })
 await app.register(routes)
 app.addHook('onClose',async()=>projectEvents.closeAll())
 return app
}
