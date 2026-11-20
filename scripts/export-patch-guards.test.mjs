import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('Exportación JSON: un solo diagrama y catálogo filtrado',()=>{
 const helper=read('apps/web/src/features/editor/standalone-diagram-export.ts')
 const editor=read('apps/web/src/features/editor/NovziEditor.tsx')
 assert.match(editor,/document:createStandaloneDiagramDocument\(doc,diagram.id\)/)
 assert.match(helper,/diagrams:\[structuredClone\(diagram\)\]/)
 assert.match(helper,/required=new Set<string>/)
 assert.match(helper,/delete copy.childDiagramId/)
 assert.doesNotMatch(editor,/document:\{\.\.\.doc,diagrams:\[diagram\]\}/)
})
test('Exportación de imagen: límites coherentes en navegador y API',()=>{
 const capture=read('apps/web/src/features/editor/capture-diagram.ts')
 const api=read('apps/api/src/modules/exports/raster-export.ts')
 assert.match(capture,/8_000_000/)
 assert.match(capture,/5_500_000/)
 assert.match(api,/10_000_000/)
 assert.match(api,/sharp.cache\(false\)/)
 assert.match(api,/sharp.concurrency\(1\)/)
})
test('Firma, licencia y registro de exportaciones no se omiten',()=>{
 const api=read('apps/api/src/modules/exports/exports.controller.ts')
 for(const needle of ['requireFeature','getEntitlements','embedProvenance','export_audit_logs','audit_events','expectedVersion'])assert.ok(api.includes(needle),needle)
 assert.match(api,/Rasterización de exportación completada/)
})
