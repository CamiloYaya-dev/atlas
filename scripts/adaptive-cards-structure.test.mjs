import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {test} from 'node:test'
const view=readFileSync('apps/web/src/features/editor/hooks/useGraphView.ts','utf8')
const node=readFileSync('apps/web/src/components/organisms/NovziNode.tsx','utf8')
const editor=readFileSync('apps/web/src/features/editor/NovziEditor.tsx','utf8')
const css=readFileSync('apps/web/src/styles.css','utf8')
test('tarjetas no UML usan altura mínima de su configuración, no altura fija',()=>{
 assert.match(view,/adaptiveCard\?\{width:size\.width,minHeight:size\.height\}:\{width:size\.width,height:size\.height\}/)
 assert.match(node,/style=\{adaptiveCard\?\{minHeight:cardMinHeight\}:undefined\}/)
})
test('contenido de la vista Mixta no se recorta por max-height',()=>{
 assert.match(css,/\.novzi-node\.novzi-adaptive-card \.node-summary\{max-height:none;overflow:visible/)
 assert.match(css,/\.novzi-node\.novzi-adaptive-card \.node-tech span/)
})
test('inspector UML está restringido a diagramas UML',()=>{
 assert.match(editor,/diagram&&isUmlDiagram\(diagram\.type\)&&diagram\.type!=='uml-activity'&&!diagram\.interaction&&can\('element\.technical\.view'\)&&<UmlDetailsEditor/)
})
