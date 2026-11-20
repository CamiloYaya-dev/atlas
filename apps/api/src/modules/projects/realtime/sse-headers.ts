import {DomainError} from '../../../domain/errors'

/** Fastify reply.hijack() bypasses headers queued by @fastify/cors.
 * The streaming response must therefore write its own allowlisted CORS headers. */
export function projectSseHeaders(origin:string|undefined,allowedOrigins:readonly string[]):Record<string,string>{
 if(origin && !allowedOrigins.includes(origin))throw new DomainError('Origen no permitido',403)
 return {
  'Content-Type':'text/event-stream; charset=utf-8',
  'Cache-Control':'no-store, no-transform',
  'X-Accel-Buffering':'no',
  'Connection':'keep-alive',
  'X-Content-Type-Options':'nosniff',
  'Vary':'Origin',
  ...(origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'}:{}),
 }
}
