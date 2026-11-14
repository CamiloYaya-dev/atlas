import {buildApp} from './app'
import {pool} from './db/pool'
import {env} from './config/env'
async function main(){
 const app=await buildApp()
 await pool.query('SELECT 1')
 await app.listen({host:env.host,port:env.port})
 app.log.info({port:env.port},'ATLAS API iniciada')
 let stopping:Promise<void>|undefined
 const stop=()=>stopping??=(async()=>{await app.close();await pool.end()})().catch(error=>{app.log.error(error,'ATLAS API: error al cerrar');process.exitCode=1})
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop())
 // A supervised Node child can close cleanly on IPC disconnect (also on Windows).
 if(process.connected)process.once('disconnect',()=>void stop())
}
main().catch(error=>{console.error('ATLAS API NO PUDO INICIAR:',error);process.exitCode=1;void pool.end()})
