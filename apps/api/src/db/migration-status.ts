import {readFile,readdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import pg from 'pg'
import {env} from '../config/env'

const pool=new pg.Pool({connectionString:process.env.MIGRATIONS_DATABASE_URL||env.databaseUrl,
 ...(env.dbSsl?{ssl:{rejectUnauthorized:true}}:{}),max:1,connectionTimeoutMillis:10000})
try {
 const {rows}=await pool.query<{filename:string;checksum:string|null}>(
  'SELECT filename,checksum FROM schema_migrations ORDER BY filename')
 const known=new Map(rows.map(r=>[r.filename,r.checksum]))
 const files=(await readdir(resolve(process.cwd(),'migrations'))).filter(n=>/^[0-9]+.*\.sql$/.test(n)).sort()
 let mismatch=0
 console.log('NOMBRE | SHA LOCAL | SHA APLICADO | ESTADO')
 for(const filename of files){
  const sql=await readFile(resolve(process.cwd(),'migrations',filename))
  const local=createHash('sha256').update(sql).digest('hex')
  const stored=known.get(filename)
  const status=stored===undefined?'PENDIENTE':!stored?'SIN CHECKSUM':stored===local?'OK':'DISTINTO'
  if(status==='DISTINTO')mismatch++
  console.log(`${filename} | ${local} | ${stored??'-'} | ${status}`)
 }
 if(mismatch){console.error(`${mismatch} migraciones difieren de los hashes aplicados. No continuar sin reconciliar.`);process.exitCode=1}
} catch(error) {console.error('No se pudieron consultar migraciones:',error);process.exitCode=1}
finally {await pool.end()}
