#!/usr/bin/env node
/**
 * NOVZI Beautify v2 – corregir tres regresiones de pruebas UI sin sustituir
 * archivos enteros ni tocar código de producto. Idempotente y transaccional:
 * valida primero los tres archivos y guarda respaldo antes de escribir.
 *
 * Desde la raiz de NOVZI:
 *   node scripts/apply-beautify-v2-ui-fix.mjs --check
 *   node scripts/apply-beautify-v2-ui-fix.mjs --apply
 */
import fs from 'node:fs'
import path from 'node:path'

const args=process.argv.slice(2)
const mode=args.includes('--apply')?'apply':args.includes('--check')?'check':null
if(!mode || (args.includes('--apply') && args.includes('--check'))){
 console.error('Uso: node scripts/apply-beautify-v2-ui-fix.mjs --check | --apply [--root C:/ruta/novzi]')
 process.exit(2)
}
const ri=args.indexOf('--root')
const root=path.resolve(ri>=0?args[ri+1]:process.cwd())
const edits=[
 {
  file:'apps/web/src/components/organisms/NovziParallelEdge.manual.browser.test.tsx',
  name:'Arrastre de tramo recto',
  apply(source){
   const old="name:/Mover tramo 2/",replacement="name:/Mover tramo 1/"
   const oldCount=source.split(old).length-1
   if(oldCount===1)return source.replace(old,replacement)
   if(oldCount===0 && source.includes(replacement))return source
   throw Error(`Se esperaba una sola búsqueda del tramo 2, hay ${oldCount}`)
  },
  verify(source){
   if(!source.includes('name:/Mover tramo 1/'))throw Error('No quedó la selección del tramo 1')
   if(!source.includes('expect(save).not.toHaveBeenCalled()')||!source.includes('expect(save).toHaveBeenCalledTimes(1)'))throw Error('Faltan pruebas de no guardar al mover y guardar una vez al soltar')
  }
 },
 {
  file:'apps/web/src/components/organisms/uml-render.browser.test.tsx',
  name:'Mock explícito de useReactFlow',
  apply(source){
   const mock=/vi\.mock\(['"]@xyflow\/react['"],\s*\(\)\s*=>\s*\(\{/g
   const matches=[...source.matchAll(mock)]
   if(matches.length!==1)throw Error(`Se esperaba un solo mock de @xyflow/react, hay ${matches.length}`)
   const start=matches[0].index,tail=source.slice(start)
   const end=tail.indexOf('}))')
   if(end<0)throw Error('No se encontró cierre del mock React Flow')
   const block=tail.slice(0,end)
   if(/\buseReactFlow\s*:/.test(block))return source
   return source.slice(0,start)+source.slice(start).replace(mock,(m)=>`${m}\n useReactFlow:()=>({screenToFlowPosition:(point:{x:number;y:number})=>point}),`)
  },
  verify(source){
   if(!/useReactFlow:\s*\(\)\s*=>\s*\(\{screenToFlowPosition:/.test(source))throw Error('No está el mock de useReactFlow')
   if(!source.includes('BaseEdge:'))throw Error('Se perdió el mock de BaseEdge')
  }
 },
 {
  file:'apps/web/src/features/editor/hooks/useGraphView.browser.test.tsx',
  name:'Renderizador editable, Bézier persistido',
  apply(source){
   const old="expect(edge.type).toBe('bezier')"
   const updated="expect(edge.type).toBe('novzi-parallel');expect(edge.data?.parallelPath).toBe('bezier')"
   const count=source.split(old).length-1
   if(count===1)return source.replace(old,updated)
   if(count===0&&source.includes(updated))return source
   throw Error(`Se esperaba una sola aserción de tipo bezier, hay ${count}`)
  },
  verify(source){
   if(!source.includes("expect(edge.type).toBe('novzi-parallel')")||!source.includes("expect(edge.data?.parallelPath).toBe('bezier')"))throw Error('Se debe comprobar tipo nuevo y estilo original')
   if(!source.includes("expect(edge.sourceHandle).toBe('top-2')")||!source.includes("expect(edge.targetHandle).toBe('bottom-3')"))throw Error('No deben desaparecer pruebas de puertos precisos')
  }
 }
]

const files=[]
try{
 for(const item of edits){
  const absolute=path.join(root,item.file)
  if(!fs.existsSync(absolute))throw Error(`${item.file}: no existe; comprueba que ejecutas desde la raíz de NOVZI`)
  const original=fs.readFileSync(absolute,'utf8')
  const updated=item.apply(original)
  item.verify(updated)
  files.push({...item,absolute,original,updated,changed:original!==updated})
 }
 console.log(`[NOVZI QA] Validación OK: ${files.length}/3 archivos.`)
 for(const file of files)console.log(`  ${file.changed?'CAMBIO':'YA CORREGIDO'} · ${file.name}`)
 if(mode==='check'){
  console.log('Modo --check: no se modificó ningún archivo.')
  process.exit(0)
 }
 if(!files.some(f=>f.changed)){
  console.log('Los tres casos ya están corregidos. Nada que modificar.')
  process.exit(0)
 }
 const backupDir=path.join(root,'test-results','qa',`backup-beautify-v2-${Date.now()}`)
 for(const file of files.filter(f=>f.changed)){
  const backupPath=path.join(backupDir,file.file)
  fs.mkdirSync(path.dirname(backupPath),{recursive:true})
  fs.copyFileSync(file.absolute,backupPath,fs.constants.COPYFILE_EXCL)
 }
 // Comprobamos la existencia de todos los respaldos antes de escribir.
 for(const file of files.filter(f=>f.changed)){
  if(!fs.existsSync(path.join(backupDir,file.file)))throw Error(`Falta respaldo: ${file.file}`)
 }
 const written=[]
 try{
  for(const file of files.filter(f=>f.changed)){
   fs.writeFileSync(file.absolute,file.updated,'utf8')
   written.push(file)
  }
 }catch(error){
  for(const file of written)fs.writeFileSync(file.absolute,file.original,'utf8')
  throw error
 }
 console.log(`[NOVZI QA] Aplicado: ${written.length} archivos de prueba. Copia original: ${path.relative(root,backupDir)}`)
 console.log('No se modificó la aplicación, la API, PostgreSQL ni las migraciones.')
}catch(error){
 console.error('[NOVZI QA] ERROR: '+(error instanceof Error?error.message:String(error)))
 console.error('Se detuvo la operación; revisa que el parche Beautify v2 esté instalado.')
 process.exit(1)
}
