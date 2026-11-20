import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const view = read('apps/web/src/features/editor/hooks/useGraphView.ts')
const card = read('apps/web/src/components/organisms/NovziNode.tsx')
const css = read('apps/web/src/styles.css')
const editor = read('apps/web/src/features/editor/NovziEditor.tsx')
test('solo Mixta usa alto guardado; otras perspectivas alto natural y misma posición',()=>{
 assert.match(view, /mode==='mixed'\?size\.height:novziNodeMinimum\(diagram\.type,element\.type\)\.height/)
 assert.match(view, /style:adaptiveCard\?\{width:size\.width,minHeight:cardMinHeight\}/)
 assert.match(view, /position,style:adaptiveCard/)
 assert.match(view, /canResize:canEdit&&\(!adaptiveCard\|\|mode==='mixed'\)/)
})
test('los conectores se anclan a la tarjeta real y React Flow mide alturas nuevas',()=>{
 assert.match(css, /\.novzi-node:not\(\.novzi-adaptive-card\)\{[^}]+height:100%!important/)
 assert.match(css, /\.novzi-node\.novzi-adaptive-card\{[^}]+height:auto!important/)
 assert.match(css, /min-height:var\(--novzi-card-min-height,65px\)!important;position:relative!important/)
 assert.match(card, /new ResizeObserver\(schedule\)/)
 assert.match(card, /requestAnimationFrame\(\(\)=>updateNodeInternals\(nodeId\)\)/)
 assert.match(card, /<AdaptiveCardPortSync nodeId=\{id\} perspective=\{mode\}\/>/)
})
test('el inspector informa qué tamaño se guarda y qué cambia por perspectiva',()=>{
 assert.match(editor, /Tamaño base \(vista mixta\)/)
 assert.match(editor, /en Funcional y Técnica la altura se adapta al contenido/)
})
