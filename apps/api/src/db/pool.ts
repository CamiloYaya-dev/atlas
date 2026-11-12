import pg from 'pg'
import {env} from '../config/env'

// Cuenta de base de datos dedicada a la API. Nunca usar la clave service_role de Supabase aquí.
// En servidores remotos activar TLS y validación de certificado; no usar rejectUnauthorized:false.
export const pool=new pg.Pool({
 connectionString:env.databaseUrl,
 ...(env.dbSsl?{ssl:{rejectUnauthorized:true}}:{}),
 max:env.dbPoolMax,
 connectionTimeoutMillis:8000,
 idleTimeoutMillis:30000,
 application_name:'atlas-api'
})
pool.on('error',error=>console.error('PostgreSQL idle client error:',error.message))
