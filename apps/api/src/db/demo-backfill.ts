/** One-time, explicit opt-in provisioning for accounts created before UX12.
 * No destructive updates. Each account gets its own transaction and project.
 */
import {pool} from './pool'
import {provisionUserDemo} from './demo-provision'
async function main(){
 const users=await pool.query<{id:string}>('SELECT id FROM novzi_users WHERE active=true ORDER BY created_at')
 let created=0,already=0
 for(const user of users.rows){
  const client=await pool.connect()
  try{
   await client.query('BEGIN')
   const result=await provisionUserDemo(client,user.id)
   await client.query('COMMIT')
   if(result.created)created++;else already++
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
 }
 console.log(`[NOVZI] DEMO: ${created} proyectos creados, ${already} existentes respetados`)
}
main().catch(error=>{console.error('[NOVZI] Demo no instalado:',error instanceof Error?error.message:error);process.exitCode=1}).finally(()=>pool.end())
