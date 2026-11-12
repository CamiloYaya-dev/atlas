import {buildApp} from './app'
import {pool} from './db/pool'
import {env} from './config/env'
async function main(){
 const app=await buildApp()
 await pool.query('SELECT 1')
 await app.listen({host:env.host,port:env.port})
 app.log.info({port:env.port},'ATLAS API iniciada')
 const stop=async()=>{await app.close();await pool.end()}
 process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop())
}
main().catch(error=>{console.error('ATLAS API NO PUDO INICIAR:',error);process.exitCode=1;void pool.end()})
