import type {FastifyInstance} from 'fastify'
import {pool} from '../../../db/pool'
import {identity} from '../../../security/identity'
import {hashPassword} from '../../../security/password'
import {DomainError,forbidden,assertUUID} from '../../../domain/errors'
function obj(x:unknown):Record<string,unknown>{if(!x||typeof x!=='object'||Array.isArray(x))throw new DomainError('Objeto JSON esperado',400);return x as Record<string,unknown>}
async function admin(req:Parameters<typeof identity>[0]){const actor=await identity(req);if(!actor.platformAdmin)throw forbidden();return actor}
export async function registerAdminController(app:FastifyInstance){
 app.get('/api/v1/admin/users',async req=>{
  await admin(req)
  const {rows}=await pool.query('SELECT id,email,display_name AS name,active,platform_admin,created_at FROM atlas_users ORDER BY created_at DESC LIMIT 300')
  return rows
 })
 app.post('/api/v1/admin/users',async(req,reply)=>{
  const actor=await admin(req),b=obj(req.body)
  const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length<2||name.length>120)throw new DomainError('Nombre o email inválido',400)
  const hash=await hashPassword(String(b.password||''))
  try{
   const {rows}=await pool.query<{id:string}>(`INSERT INTO atlas_users(email,display_name,password_hash,created_by)
      VALUES ($1,$2,$3,$4) RETURNING id`,[email,name,hash,actor.id])
   return reply.code(201).send({id:rows[0].id,email,name,active:true})
  }catch(e){if((e as {code?:string}).code==='23505')throw new DomainError('El correo ya está registrado',409);throw e}
 })
 app.patch<{Params:{userId:string}}>('/api/v1/admin/users/:userId',async(req)=>{
  const actor=await admin(req);assertUUID(req.params.userId)
  const b=obj(req.body)
  if(typeof b.active==='boolean'){
   if(req.params.userId===actor.id&&!b.active)throw new DomainError('No puedes deshabilitar tu propia cuenta',409)
   const {rowCount}=await pool.query('UPDATE atlas_users SET active=$1,updated_at=now() WHERE id=$2 AND platform_admin=false',[b.active,req.params.userId])
   if(!rowCount)throw new DomainError('Usuario no encontrado o cuenta protegida',404)
   if(!b.active)await pool.query('UPDATE atlas_sessions SET revoked_at=now() WHERE user_id=$1',[req.params.userId])
   return {ok:true}
  }
  if(typeof b.password==='string'){
   if(req.params.userId===actor.id)throw new DomainError('El cambio de clave propia tendrá un flujo independiente',409)
   const hash=await hashPassword(b.password)
   const {rowCount}=await pool.query('UPDATE atlas_users SET password_hash=$1,updated_at=now() WHERE id=$2 AND platform_admin=false',[hash,req.params.userId])
   if(!rowCount)throw new DomainError('Usuario no encontrado o cuenta protegida',404)
   await pool.query('UPDATE atlas_sessions SET revoked_at=now() WHERE user_id=$1',[req.params.userId])
   return {ok:true}
  }
  throw new DomainError('Se requiere active:boolean o password:string',400)
 })
}
