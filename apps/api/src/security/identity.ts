import {createHmac,timingSafeEqual} from 'node:crypto'
import {pool} from '../db/pool'
import {env} from '../config/env'
import {hashSecret} from './password'
import type {FastifyRequest} from 'fastify'
export const DEMO_USER_ID='00000000-0000-4000-8000-000000000001'
export interface Actor{id:string;email:string;displayName:string;platformAdmin:boolean;sessionId:string;rawToken:string}
const cookieName='atlas_session'
export function readCookie(req:FastifyRequest){
 const raw=req.headers.cookie||''
 const match=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))
 return match?decodeURIComponent(match.slice(cookieName.length+1)):''
}
export function csrfFor(token:string){return createHmac('sha256',env.csrfSecret).update('atlas-csrf:'+token).digest('base64url')}
export function secureCookie(token:string,clear=false){
 const pieces=[`${cookieName}=${clear?'':encodeURIComponent(token)}`,'HttpOnly','SameSite=Lax','Path=/api/v1',`Max-Age=${clear?0:43200}`]
 if(env.nodeEnv==='production')pieces.push('Secure')
 return pieces.join('; ')
}
export async function identity(request:FastifyRequest):Promise<Actor>{
 const token=readCookie(request)
 if(!token||!/^[A-Za-z0-9_-]{40,100}$/.test(token))throw Object.assign(new Error('No autenticado'),{statusCode:401})
 const {rows}=await pool.query<{id:string;email:string;display_name:string;platform_admin:boolean;session_id:string}>(
 `SELECT u.id,u.email,u.display_name,u.platform_admin,s.id AS session_id
 FROM atlas_sessions s JOIN atlas_users u ON u.id=s.user_id
 WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.active=true`,[hashSecret(token)])
 const data=rows[0]
 if(!data)throw Object.assign(new Error('Sesión expirada o revocada'),{statusCode:401})
 return {id:data.id,email:data.email,displayName:data.display_name,platformAdmin:data.platform_admin,sessionId:data.session_id,rawToken:token}
}
export async function requireCsrf(req:FastifyRequest){
 const actor=await identity(req)
 const supplied=req.headers['x-csrf-token']
 const actual=typeof supplied==='string'?supplied:''
 const expected=csrfFor(actor.rawToken)
 const a=Buffer.from(actual),b=Buffer.from(expected)
 if(a.length!==b.length||!timingSafeEqual(a,b))throw Object.assign(new Error('Token CSRF inválido'),{statusCode:403})
 return actor
}
