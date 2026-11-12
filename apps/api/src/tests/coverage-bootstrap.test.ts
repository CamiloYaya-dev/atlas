/**
 * Prepara exclusivamente la base atlas_test para probar scripts de entrada.
 * No modifica la base local de trabajo, ni registra usuarios por HTTP.
 */
import {pool} from '../db/pool'
import {hashPassword} from '../security/password'
import {DEMO_USER_ID} from '../security/identity'
const uri=process.env.DATABASE_URL||''
if(process.env.NODE_ENV!=='test'||process.env.ATLAS_ALLOW_DB_TESTS!=='true'||!/127\.0\.0\.1:5433\/atlas_test(?:\?|$)/.test(uri))throw Error('Bootstrap QA bloqueado fuera de atlas_test:5433')
try{
 const pass=await hashPassword('QA-Bootstrap-Local-2026!')
 await pool.query(`INSERT INTO atlas_users(id,email,display_name,password_hash,platform_admin,active)
   VALUES($1,$2,'Administrador semilla QA',$3,false,true)
   ON CONFLICT (id) DO NOTHING`,[DEMO_USER_ID,'coverage-bootstrap@atlas.test',pass])
 console.log('QA bootstrap: cuenta semilla existente o preparada solamente en atlas_test')
}finally{await pool.end()}
