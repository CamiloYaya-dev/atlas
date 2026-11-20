#!/usr/bin/env node
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const args=process.argv.slice(2)
if(args.length!==1||!['--check','--apply'].includes(args[0])){
 console.error('Uso: node scripts/apply-reactflow-measurements.mjs --check|--apply')
 process.exit(2)
}
const file=resolve(process.cwd(),'apps/web/src/features/editor/NovziEditor.tsx')
const helper=resolve(process.cwd(),'apps/web/src/features/editor/domain/preserve-reactflow-measurements.ts')
if(!existsSync(file)||!existsSync(helper)){
 console.error('[NOVZI QA] Faltan archivos en la raíz NOVZI; extrae el ZIP conservando las rutas.')
 process.exit(1)
}
const original=readFileSync(file,'utf8')
const oldImport="import {useGraphView} from './hooks/useGraphView'"
const newImport=oldImport+"\nimport {preserveReactFlowMeasurements} from './domain/preserve-reactflow-measurements'"
const oldFocus="focusedElementId:hoveredElementId||selectedId"
const newFocus="focusedElementId:focusRelations&&!!diagram&&diagram.edges.length>=10?hoveredElementId||selectedId:null"
const oldEffect=" useEffect(()=>{setDisplayNodes(filtered.nodes);setDisplayEdges(filtered.edges)},[filtered.nodes,filtered.edges,setDisplayNodes,setDisplayEdges])"
const newEffect=" const measuredDiagramId=useRef<string|null>(null)\n useEffect(()=>{\n  const sameDiagram=!!diagram&&measuredDiagramId.current===diagram.id\n  measuredDiagramId.current=diagram?.id??null\n  setDisplayNodes(previous=>preserveReactFlowMeasurements(filtered.nodes,previous,sameDiagram))\n  setDisplayEdges(filtered.edges)\n },[diagram?.id,filtered.nodes,filtered.edges,setDisplayNodes,setDisplayEdges])"

if(original.includes('preserveReactFlowMeasurements(filtered.nodes,previous,sameDiagram)')){
 console.log('[NOVZI QA] Esta corrección ya está aplicada; no se modifica el editor.')
 process.exit(0)
}
function single(src,needle,label){const count=src.split(needle).length-1;if(count!==1)throw Error(`Se esperaba 1 ocurrencia de ${label}, encontradas ${count}. NO se ha modificado el archivo.`)}
try{
 single(original,oldImport,'import de useGraphView')
 single(original,oldFocus,'identificador de relación enfocada')
 single(original,oldEffect,'efecto de nodos React Flow')
 if(!original.includes('useRef'))throw Error('No se encontró useRef en este editor')
}catch(error){console.error('[NOVZI QA] '+error.message);process.exit(1)}
const changed=original.replace(oldImport,newImport).replace(oldFocus,newFocus).replace(oldEffect,newEffect)
console.log('[NOVZI QA] Compatible: conserva mediciones en el editor sin modificar documentos, permisos ni conexiones.')
if(args[0]==='--check')process.exit(0)
const backup=file+'.backup-geometry-'+new Date().toISOString().replace(/[:.]/g,'-')
copyFileSync(file,backup)
writeFileSync(file,changed)
console.log('[NOVZI QA] Actualizado: apps/web/src/features/editor/NovziEditor.tsx')
console.log('[NOVZI QA] Respaldo: '+backup)
console.log('[NOVZI QA] SHA-256: '+createHash('sha256').update(changed).digest('hex'))
