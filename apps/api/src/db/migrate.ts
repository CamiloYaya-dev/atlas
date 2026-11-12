import {readFile,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import pg from 'pg'
import {env} from '../config/env'
// Permite usar credenciales migradoras fuera de la API, con privilegios DDL.
const pool=new pg.Pool({connectionString:process.env.MIGRATIONS_DATABASE_URL||env.databaseUrl,
 ...(env.dbSsl?{ssl:{rejectUnauthorized:true}}:{}),max:1,connectionTimeoutMillis:10000})
const dir=resolve(process.cwd(),'migrations')
async function migrate(){
 const client=await pool.connect()
 try{
  // Dos despliegues simultáneos no pueden ejecutar migraciones al mismo tiempo.
  await client.query('SELECT pg_advisory_lock(58741321)')
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
   filename text PRIMARY KEY,checksum text,applied_at timestamptz NOT NULL DEFAULT now())`)
  await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text')
  const files=(await readdir(dir)).filter(n=>/^[0-9]+.*\.sql$/.test(n)).sort()
  for(const name of files){
   const sql=await readFile(resolve(dir,name),'utf8')
   const checksum=createHash('sha256').update(sql).digest('hex')
   const existing=await client.query<{checksum:string|null}>('SELECT checksum FROM schema_migrations WHERE filename=$1',[name])
   if(existing.rows[0]){
    if(existing.rows[0].checksum&&existing.rows[0].checksum!==checksum)throw new Error(`MIGRACION MODIFICADA: ${name}. Nunca edites migraciones aplicadas; crea otra versión.`)
    if(!existing.rows[0].checksum)await client.query('UPDATE schema_migrations SET checksum=$2 WHERE filename=$1',[name,checksum])
    console.log('Ya aplicada:',name);continue
   }
   await client.query('BEGIN')
   try{await client.query(sql);await client.query('INSERT INTO schema_migrations(filename,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');console.log('Migración aplicada:',name)}
   catch(error){await client.query('ROLLBACK');throw error}
  }
 }finally{try{await client.query('SELECT pg_advisory_unlock(58741321)')}finally{client.release();await pool.end()}}
}
migrate().catch(error=>{console.error('MIGRACIÓN FALLIDA:',error);process.exitCode=1})
