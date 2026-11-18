import test from 'node:test'
import assert from 'node:assert/strict'
import {pool} from './pool'
import {env} from '../config/env'
// Does not open a connection: checks actual pool configuration and error reporting.
test('pool configura los límites, identidad y TLS del entorno sin abrir conexiones',()=>{
 const opts=(pool as unknown as {options:{connectionString?:string;max?:number;connectionTimeoutMillis?:number;idleTimeoutMillis?:number;application_name?:string;ssl?:unknown}}).options
 assert.equal(opts.connectionString,env.databaseUrl)
 assert.equal(opts.max,env.dbPoolMax);assert.equal(opts.connectionTimeoutMillis,8000);assert.equal(opts.idleTimeoutMillis,30000);assert.equal(opts.application_name,'novzi-api')
 if(env.dbSsl)assert.deepEqual(opts.ssl,{rejectUnauthorized:true})
 else assert.ok(!opts.ssl)
 assert.equal(pool.totalCount,0)
})
test('pool registra errores de clientes inactivos sin lanzar una excepción no controlada',async()=>{
 const seen:unknown[][]=[],original=console.error
 try{console.error=(...args:unknown[])=>{seen.push(args)};pool.emit('error',new Error('QA desconexión de cliente'));assert.deepEqual(seen,[['PostgreSQL idle client error:','QA desconexión de cliente']])}
 finally{console.error=original;await pool.end()}
})
