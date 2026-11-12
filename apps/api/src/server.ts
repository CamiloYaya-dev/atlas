import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import {pool} from './db/pool'
import {env} from './config/env'
import {routes} from './http/routes'
import {requireCsrf} from './security/identity'
async function main(){
 const app=Fastify({logger:{redact:['req.headers.authorization','req.headers.cookie','req.body.password']},bodyLimit:5*1024*1024,
 trustProxy:env.trustProxy,requestIdHeader:'x-request-id'})
 await app.register(cors,{origin:(origin,cb)=>cb(null,!origin||env.allowedOrigins.includes(origin)),
  methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token','X-Request-ID'],credentials:true,maxAge:600})
 await app.register(rateLimit,{global:true,max:100,timeWindow:'1 minute',errorResponseBuilder:()=>({statusCode:429,message:'Demasiadas solicitudes'})})
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
 await pool.query('SELECT 1')
 await app.listen({host:env.host,port:env.port})
 app.log.info({port:env.port},'ATLAS API 4.2 iniciada')
 const stop=async()=>{await app.close();await pool.end()}
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop())
}
main().catch(error=>{console.error('ATLAS API NO PUDO INICIAR:',error);process.exitCode=1;void pool.end()})
