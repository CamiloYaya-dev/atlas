import fs from 'node:fs'
import path from 'node:path'

const filename = path.join(process.cwd(), 'apps/web/src/components/organisms/NovziParallelEdge.tsx')
if (!fs.existsSync(filename)) {
  console.error('[NOVZI] No encuentro NovziParallelEdge.tsx. Ejecuta desde la raiz del monorepo.')
  process.exit(1)
}
const before = fs.readFileSync(filename, 'utf8')
const from = 'removeRouteBend,shiftSegment,simplifyRoute'
const to = 'removeRouteBend,simplifyRoute'
const already = before.includes(to) && !before.includes(from)
if (already) {
  console.log('[NOVZI] La importacion ya esta corregida; no se modifico nada.')
  process.exit(0)
}
if (before.split(from).length !== 2) {
  console.error('[NOVZI] La importacion no coincide con la esperada; no se modifico nada. Revisa manualmente la linea 9.')
  process.exit(1)
}
const backup = filename + '.backup-unused-shiftSegment'
if (!fs.existsSync(backup)) fs.copyFileSync(filename, backup)
fs.writeFileSync(filename, before.replace(from, to), 'utf8')
console.log('[NOVZI] Importacion corregida: shiftSegment retirado de NovziParallelEdge.tsx.')
console.log('[NOVZI] Respaldo: ' + backup)
