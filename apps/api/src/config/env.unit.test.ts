import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseEnv} from './env'

const local={DATABASE_URL:'postgresql://qa:qa@127.0.0.1:5433/novzi_test',NOVZI_CSRF_SECRET:'qa-only-secret-for-configuration-novzi-2026'}
const prod={...local,NODE_ENV:'production',DATABASE_URL:'postgresql://qa:qa@db.example.test/novzi',CORS_ORIGINS:'https://novzi.example.test',NOVZI_EXPORT_SIGNING_KEY:'qa-only-signing-key-for-configuration-2026',DB_SSL:'true'}
test('configuración local: valores por defecto, fallback de firma y cookies no seguras',()=>{
 const env=parseEnv(local)
 assert.deepEqual(env,{nodeEnv:'development',port:3001,host:'127.0.0.1',databaseUrl:local.DATABASE_URL,csrfSecret:local.NOVZI_CSRF_SECRET,authMode:'local',allowedOrigins:['http://localhost:5173','http://127.0.0.1:5173'],exportSigningKey:local.NOVZI_CSRF_SECRET,dbSsl:false,dbPoolMax:5,trustProxy:false,secureCookies:false})
})
test('configuración remota: normaliza orígenes y habilita TLS, proxy y cookies seguras',()=>{
 const env=parseEnv({...prod,HOST:'0.0.0.0',PORT:'65535',DB_POOL_MAX:'40',TRUST_PROXY:'true',CORS_ORIGINS:' https://a.example.test, ,https://b.example.test '})
 assert.equal(env.port,65535);assert.equal(env.dbPoolMax,40);assert.equal(env.host,'0.0.0.0')
 assert.deepEqual(env.allowedOrigins,['https://a.example.test','https://b.example.test']);assert.equal(env.exportSigningKey,prod.NOVZI_EXPORT_SIGNING_KEY)
 assert.equal(env.dbSsl,true);assert.equal(env.trustProxy,true);assert.equal(env.secureCookies,true)
 assert.equal(parseEnv(prod).host,'0.0.0.0');assert.equal(parseEnv({...local,NOVZI_SECURE_COOKIES:'true',PORT:'1',DB_POOL_MAX:'1'}).secureCookies,true)
})
const invalid:[string,NodeJS.ProcessEnv,RegExp][]=[
 ['sin base',{DATABASE_URL:''},/DATABASE_URL requerido/],['modo demo',{AUTH_MODE:'demo'},/AUTH_MODE=local/],
 ...['0','65536','3000.5','NaN'].map((PORT):[string,NodeJS.ProcessEnv,RegExp]=>['puerto '+PORT,{PORT},/PORT inválido/]),
 ['CSRF corto',{NOVZI_CSRF_SECRET:'short'},/CSRF_SECRET/],
 ...['0','41','2.5','NaN'].map((DB_POOL_MAX):[string,NodeJS.ProcessEnv,RegExp]=>['pool '+DB_POOL_MAX,{DB_POOL_MAX},/DB_POOL_MAX inválido/]),
 ['CORS no cifrado',{...prod,CORS_ORIGINS:'http://bad.example.test'},/CORS_ORIGINS/],['CORS comodín',{...prod,CORS_ORIGINS:'*'},/CORS_ORIGINS/],
 ['firma corta',{...prod,NOVZI_EXPORT_SIGNING_KEY:'short'},/NOVZI_EXPORT_SIGNING_KEY/],['TLS ausente',{...prod,DB_SSL:'false'},/DB_SSL=true/],
 ['BD de QA prohibida en producción',{...prod,DATABASE_URL:local.DATABASE_URL},/DATABASE_URL local/],['localhost prohibido en producción',{...prod,DATABASE_URL:'postgresql://qa:qa@localhost/novzi'},/DATABASE_URL local/],
]
for(const [label,overrides,expected] of invalid)test('rechaza '+label,()=>assert.throws(()=>parseEnv({...local,...overrides}),expected))
