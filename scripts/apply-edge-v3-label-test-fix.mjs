#!/usr/bin/env node
// Targeted, idempotent patch: only the two failing Edge Editor v3 UI tests.
import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const file=path.join(root,'apps/web/src/components/organisms/NovziParallelEdge.v3.browser.test.tsx')
const action=process.argv.includes('--apply')?'apply':'check'
if(!fs.existsSync(file))throw Error(`No se encuentra ${file}; ejecuta desde la raíz de NOVZI`)
const original=fs.readFileSync(file,'utf8')
const replacements=[
 [
  'afterEach(cleanup)\\n',
  `afterEach(cleanup)\n// jsdom does not consistently implement PointerEvent coordinates. A MouseEvent\n// dispatched with a pointer* type preserves real clientX/clientY for the\n// component's native window pointer listeners and React's onPointerDown.\nconst pointerWithCoordinates=(target:Element|Window,type:'pointerdown'|'pointermove'|'pointerup',clientX:number,clientY:number)=>{\n fireEvent(target,new MouseEvent(type,{bubbles:true,cancelable:true,clientX,clientY}))\n}\n`
 ],
 [
  `  fireEvent.pointerDown(label,{clientX:160,clientY:80})\n  fireEvent.pointerMove(window,{clientX:180,clientY:100})\n  fireEvent.pointerMove(window,{clientX:190,clientY:110})\n  expect(save).not.toHaveBeenCalled()\n  fireEvent.pointerUp(window,{clientX:190,clientY:110})`,
  `  const before=label.style.transform\n  pointerWithCoordinates(label,'pointerdown',160,80)\n  pointerWithCoordinates(window,'pointermove',180,100)\n  pointerWithCoordinates(window,'pointermove',190,110)\n  expect(label.style.transform).not.toBe(before) // Preview, before persisting\n  expect(save).not.toHaveBeenCalled()\n  pointerWithCoordinates(window,'pointerup',190,110)`
 ],
 [
  `  expect(label.getAttribute('style')).toContain('215px, 190px')`,
  `  expect(label.style.transform).toMatch(/translate\\(215px,\\s*190px\\)/)`
 ]
]
// first replacement literal corrected below; keep source string in exact form
replacements[0][0]='afterEach(cleanup)\n'
let next=original
let updates=0
for (let i=0;i<replacements.length;i++) {
 const [oldText,newText]=replacements[i]
 if (next.includes(newText))continue
 const count=next.split(oldText).length-1
 if(count!==1)throw Error(`No se pudo aplicar el cambio ${i+1}: esperado exactamente 1 bloque, encontrados ${count}. Archivo incompatible; no se modificó nada.`)
 next=next.replace(oldText,newText)
 updates++
}
if(updates===0){console.log('[NOVZI QA] Las dos pruebas ya están corregidas. No se necesitan cambios.');process.exit(0)}
console.log(`[NOVZI QA] Compatible: ${updates} sustituciones puntuales en las dos pruebas de etiquetas.`)
if(action==='check'){console.log('[NOVZI QA] Modo --check: sin cambios.');process.exit(0)}
const backup=`${file}.backup-edge-v3-label-tests`
if(!fs.existsSync(backup))fs.copyFileSync(file,backup)
fs.writeFileSync(file,next)
console.log(`[NOVZI QA] Actualizado: ${file}`)
console.log(`[NOVZI QA] Respaldo: ${backup}`)
