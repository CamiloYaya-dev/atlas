import {describe,expect,it} from 'vitest'
import App from './App'
import {demoDocument} from './demo'
import * as compat from './lib'
import {emptyDoc,diagramLabels,createElement} from './types'
import {demoDocument as fixture} from '@atlas/fixtures'
import {request} from './shared/api/http'

// Garantiza que los puntos públicos de entrada y compatibilidad V3 conservan
// los mismos contratos. No se importan para inflar cobertura sin aserciones.
describe('Entrypoints web y compatibilidad hacia atrás',()=>{
 it('App expone el editor real y no lo sustituye por un modo demo',()=>{
  expect(typeof App).toBe('function')
  expect(App.name).toBe('AtlasEditor')
 })
 it('demo conserva la misma fábrica reutilizable del paquete fixtures',()=>{
  expect(demoDocument).toBe(fixture)
  const doc=demoDocument()
  expect(doc.diagrams.some(d=>d.type==='c1')).toBe(true)
  expect(doc.diagrams.some(d=>d.type==='c4')).toBe(true)
  expect(doc.elements['platform'].childDiagramId).toBe('c2')
 })
 it('lib mantiene las exportaciones HTTP y de recursos del monorepo',()=>{
  expect(compat.request).toBe(request)
  expect(typeof compat.listProjects).toBe('function')
  expect(typeof compat.listWorkspaces).toBe('function')
 })
 it('types reexporta los contratos funcionales, técnicos y de diagrama',()=>{
  expect(typeof emptyDoc).toBe('function')
  expect(emptyDoc().schema).toBe(1)
  expect(diagramLabels.c1).toContain('Contexto')
  expect(createElement('Contrato QA','requirement').type).toBe('requirement')
 })
})
