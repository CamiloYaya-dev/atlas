/** Destructive demo reset may run only against the local DEVELOPMENT database.
 * QA uses another database on 5433; remote and production URLs are forbidden.
 */
export const RESET_ACTION_KEY = 'novzi-local-initial-demo-reset-v1'
export const RESET_CONFIRMATION = 'REINICIAR-SOLO-DEMOS'
export function assertLocalDemoResetAllowed(raw:NodeJS.ProcessEnv):void {
 if (raw.NODE_ENV==='production'||raw.NODE_ENV==='test'||raw.NOVZI_ALLOW_DB_TESTS==='true') {
  throw Error('Reinicio prohibido en producción y QA')
 }
 const urlString=raw.DATABASE_URL||''
 let url:URL
 try {url=new URL(urlString)}catch {throw Error('DATABASE_URL inválida para el reinicio')}
 if (!['postgres:','postgresql:'].includes(url.protocol)
  || !['127.0.0.1','localhost'].includes(url.hostname)
  || Number(url.port||'5432')!==5432
  || !['atlas','novzi'].includes(decodeURIComponent(url.pathname.slice(1)))) {
  throw Error('Reinicio solo disponible para PostgreSQL de DESARROLLO local en 127.0.0.1:5432 (atlas/novzi)')
 }
 if (raw.MIGRATIONS_DATABASE_URL && raw.MIGRATIONS_DATABASE_URL!==urlString) {
  throw Error('MIGRATIONS_DATABASE_URL apunta a otra base: reinicio bloqueado')
 }
}
export function isExplicitDemoReset(args:string[]):boolean {
 if (!args.includes('--apply'))return false
 if (!args.includes(`--confirm=${RESET_CONFIRMATION}`))throw Error(`Para aplicar, añade --confirm=${RESET_CONFIRMATION}`)
 const unknown=args.filter(a=>a!=='--apply'&&a!==`--confirm=${RESET_CONFIRMATION}`)
 if (unknown.length)throw Error('Parámetros no reconocidos: '+unknown.join(', '))
 return true
}
