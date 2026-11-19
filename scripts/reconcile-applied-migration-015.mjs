/**
 * NOVZI: recupera la copia histórica EXACTA de una migración aplicada,
 * exclusivamente si existe en el historial de Git y coincide por SHA-256
 * con el checksum registrado por PostgreSQL.
 *
 * NO ejecuta SQL; NO cambia schema_migrations; NO modifica bases de datos.
 * Por defecto: diagnóstico de solo lectura. --apply requiere coincidencia exacta.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const rel = 'apps/api/migrations/015_rebrand_novzi.sql'
const dest = resolve(root, rel)
const applying = process.argv.includes('--apply')
const sha = b => createHash('sha256').update(b).digest('hex')
const invoke = (cmd, args, opts={}) => {
  const r = spawnSync(cmd, args, {cwd:root, maxBuffer: 16 * 1024 * 1024, ...opts})
  if (r.error) throw r.error
  if (r.status !== 0 && !opts.allowFailure) {
    throw new Error(`${cmd} ${args.join(' ')} terminó con código ${r.status}: ${(r.stderr??'').toString().slice(0,1000)}`)
  }
  return r
}
const runStatus = () => {
  // cmd.exe evita las limitaciones de spawnSync con npm.cmd en Windows.
  const isWin = process.platform === 'win32'
  const r = isWin
    ? invoke(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run db:migrations:status'], {encoding:'utf8',allowFailure:true})
    : invoke('npm', ['run', 'db:migrations:status'], {encoding:'utf8',allowFailure:true})
  const output = `${r.stdout??''}\n${r.stderr??''}`
  const line = output.split(/\r?\n/).find(x=>x.trim().startsWith('015_rebrand_novzi.sql |'))
  if (!line) throw new Error(`No pude obtener el checksum 015 desde npm run db:migrations:status. Ejecuta el comando manualmente.\n${output.slice(-3000)}`)
  const cols = line.split('|').map(x=>x.trim())
  const expected = cols[2]
  if (!/^[0-9a-f]{64}$/i.test(expected)) throw new Error(`Checksum aplicado inválido: ${expected}`)
  console.log('Estado 015:', cols[3], '| registrado en BD:', expected)
  return {expected:expected.toLowerCase(), status:cols[3], output}
}
try {
  if(!existsSync(dest)) throw new Error(`No existe ${rel} en ${root}`)
  const local = readFileSync(dest)
  const localHash = sha(local)
  const {expected, status} = runStatus()
  console.log('Archivo local SHA-256:', localHash)
  if(localHash === expected) {
    console.log('OK: el archivo 015 coincide exactamente con PostgreSQL. No hay nada que restaurar.')
    process.exit(0)
  }
  console.log('Buscando en Git un archivo 015 con el checksum exacto aplicado...')
  const commits = invoke('git',['log','--all','--format=%H','--',rel],{encoding:'utf8'}).stdout.trim().split(/\r?\n/).filter(Boolean)
  let match
  for (const commit of commits) {
    const r=invoke('git',['show',`${commit}:${rel}`],{allowFailure:true})
    if (r.status!==0 || !Buffer.isBuffer(r.stdout)) continue
    if(sha(r.stdout) === expected) { match = {commit, bytes:r.stdout}; break }
  }
  if(!match) {
    console.error('NO ENCONTRADO: ningún commit de Git conserva la versión 015 que figura aplicada.')
    console.error('No se modificó ningún archivo. Busca una copia histórica de 015_rebrand_novzi.sql o comparte los hashes del estado de migraciones.')
    process.exitCode = 2
  } else {
    console.log('Coincidencia exacta en commit:',match.commit)
    if (!applying) {
      console.log('SIMULACIÓN: no se modificó nada. Para restaurar solo 015 ejecuta:')
      console.log('node scripts/reconcile-applied-migration-015.mjs --apply')
    } else {
      const backup = `${dest}.antes-de-reparar.${new Date().toISOString().replaceAll(':','-')}.bak`
      writeFileSync(backup,local)
      writeFileSync(dest,match.bytes)
      if(sha(readFileSync(dest))!==expected) {
        writeFileSync(dest,local)
        throw new Error('La escritura no conservó el checksum: se devolvió la versión previa.')
      }
      console.log('Archivo histórico restaurado y verificado con SHA-256.')
      console.log('Copia del archivo anterior:',backup)
      console.log('Ahora ejecuta: npm run db:migrations:status, luego npm run db:migrate.')
    }
  }
} catch(err) {console.error('No se realizaron cambios inseguros:',err.message);process.exitCode=1}
