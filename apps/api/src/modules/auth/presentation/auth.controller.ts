import {randomBytes} from 'node:crypto'
import type {FastifyInstance} from 'fastify'
import {pool} from '../../../db/pool'
import {identity,secureCookie,csrfFor,readCookie} from '../../../security/identity'
import {verifyPassword,hashPassword,hashSecret} from '../../../security/password'
import {DomainError} from '../../../domain/errors'
const badInput=(x:unknown)=>!x||typeof x!=='object'||Array.isArray(x)?{}:x as Record<string,unknown>
const badCredentials=()=>new DomainError('Credenciales incorrectas o cuenta deshabilitada',401)
export async function registerAuthRoutes(app:FastifyInstance){
 app.get('/api/v1/auth/me',async req=>{
  const actor=await identity(req)
  return {user:{id:actor.id,email:actor.email,name:actor.displayName,platformAdmin:actor.platformAdmin},csrfToken:csrfFor(actor.rawToken)}
 })
 app.post('/api/v1/auth/login',{config:{rateLimit:{max:6,timeWindow:'1 minute'}}},async(req,reply)=>{
  const b=badInput(req.body),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'')
  if(email.length>254||password.length>128)throw badCredentials()
  const result=await pool.query<{id:string;email:string;display_name:string;password_hash:string;active:boolean;platform_admin:boolean}>(
   'SELECT id,email,display_name,password_hash,active,platform_admin FROM atlas_users WHERE email=$1',[email])
  const user=result.rows[0]
  // Hash a dummy password too when email is unknown, so timing is less revealing.
  const dummy='scrypt$32768$8$3$'+Buffer.alloc(24,7).toString('base64url')+'$'+Buffer.alloc(64).toString('base64url')
  const valid=await verifyPassword(password,user?.password_hash||dummy)
  if(!valid||!user||!user.active)throw badCredentials()
  const token=randomBytes(48).toString('base64url')
  await pool.query(`INSERT INTO atlas_sessions(user_id,token_hash,csrf_hash,expires_at)
    VALUES($1,$2,$3,now()+interval '12 hours')`,[user.id,hashSecret(token),hashSecret(csrfFor(token))])
  reply.header('Set-Cookie',secureCookie(token))
  reply.header('Cache-Control','no-store')
  return {user:{id:user.id,email:user.email,name:user.display_name,platformAdmin:user.platform_admin},csrfToken:csrfFor(token)}
 })
 app.post('/api/v1/auth/logout',async(req,reply)=>{
  const token=readCookie(req)
  if(token)await pool.query('UPDATE atlas_sessions SET revoked_at=now() WHERE token_hash=$1',[hashSecret(token)])
  reply.header('Set-Cookie',secureCookie('',true))
  return {ok:true}
 })
}
