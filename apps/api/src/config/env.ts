import 'dotenv/config'
const bool=(v:string|undefined)=>v==='true'
const nodeEnv=process.env.NODE_ENV||'development'
const authMode=process.env.AUTH_MODE||'local'
const host=process.env.HOST|| (nodeEnv==='production'?'0.0.0.0':'127.0.0.1')
const databaseUrl=process.env.DATABASE_URL||''
const csrfSecret=process.env.ATLAS_CSRF_SECRET||''
const allowedOrigins=(process.env.CORS_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim()).filter(Boolean)
const port=Number(process.env.PORT||3001)
if(!databaseUrl)throw Error('DATABASE_URL requerido en apps/api/.env')
if(authMode!=='local')throw Error('ATLAS V4.2 requiere AUTH_MODE=local. Se eliminó el modo demo sin autenticación.')
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT inválido')
if(csrfSecret.length<32)throw Error('ATLAS_CSRF_SECRET debe contener al menos 32 caracteres aleatorios')
if(nodeEnv==='production'){
 if(allowedOrigins.some(x=>x==='*'||!x.startsWith('https://')))throw Error('CORS_ORIGINS producción: solo orígenes HTTPS específicos')
 if(!bool(process.env.DB_SSL))throw Error('En producción DB_SSL=true es obligatorio')
 if(/localhost|127\.0\.0\.1/i.test(databaseUrl))throw Error('Producción no debe usar DATABASE_URL local')
}
export const env={nodeEnv,port,host,databaseUrl,csrfSecret,authMode:'local' as const,allowedOrigins,
 dbSsl:bool(process.env.DB_SSL),dbPoolMax:Number(process.env.DB_POOL_MAX||5),trustProxy:bool(process.env.TRUST_PROXY)}
if(!Number.isInteger(env.dbPoolMax)||env.dbPoolMax<1||env.dbPoolMax>40)throw Error('DB_POOL_MAX inválido')
