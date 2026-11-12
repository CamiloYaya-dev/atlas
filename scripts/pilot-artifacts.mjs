/** pilot:start NO recompila: solo arranca artefactos previamente construidos. */
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const required=['apps/api/dist/server.js','apps/web/dist/index.html']
const missing=required.filter(path=>!existsSync(resolve(root,path)))
if(missing.length){
 console.error(`[ATLAS PILOTO] No existe la compilación: ${missing.join(', ')}.`)
 console.error('Ejecuta npm run pilot:build UNA vez, antes de iniciar pilot:start.')
 process.exitCode=1
}else{
 console.log('[ATLAS PILOTO] API y frontend compilados presentes. Se iniciarán sin recompilar.')
}
