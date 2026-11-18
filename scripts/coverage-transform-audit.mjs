import {readFileSync,readdirSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {relative,isAbsolute,resolve} from 'node:path'
import {createHash} from 'node:crypto'

/** V8 counts offsets in generated JS, not TS. c8 merges raw offsets by URL before
 * remapping. If two processes use different JS for that URL the result is invalid.
 * Reject a missing, stale or conflicting map instead of filtering any source. */
export function auditCoverageTransforms(directory,root){
 if(!directory)throw Error('Cobertura V8: falta el directorio de datos crudos')
 const seen=new Map();let scripts=0,reports=0
 for(const name of readdirSync(directory).filter(n=>/^coverage-.*\.json$/.test(n)).sort()){
  const report=JSON.parse(readFileSync(resolve(directory,name),'utf8'));reports++
  if(!Array.isArray(report.result))throw Error(`Cobertura V8 inválida: ${name}`)
  for(const entry of report.result){
   if(!entry.url?.startsWith('file:'))continue
   const path=fileURLToPath(entry.url),key=relative(root,path).replaceAll('\\','/')
   if(isAbsolute(key)||key.startsWith('../')||! /^(apps|packages)\/[^/]+\/src\/.*\.tsx?$/.test(key)||key.includes('/node_modules/'))continue
   const map=report['source-map-cache']?.[entry.url]
   if(typeof map?.data?.mappings!=='string'||!Array.isArray(map.lineLengths)||map.data.sourcesContent?.length!==1||map.data.sourcesContent[0]!==readFileSync(path,'utf8'))throw Error(`Mapa fuente ausente o incorrecto: ${key} (${name})`)
   const fingerprint=createHash('sha256').update(JSON.stringify([map.lineLengths,map.data.mappings,map.data.sourcesContent])).digest('hex')
   if(seen.has(key)&&seen.get(key)!==fingerprint)throw Error(`Transformaciones incompatibles para ${key} (${name})`)
   seen.set(key,fingerprint);scripts++
  }
 }
 if(!reports||!scripts)throw Error('Cobertura V8: no se encontraron mapas del proyecto')
 return {reports,scripts,files:seen.size}
}
