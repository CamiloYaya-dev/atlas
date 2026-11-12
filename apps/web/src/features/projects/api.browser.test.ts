import {describe,it,expect,vi,beforeEach} from 'vitest'
import {emptyDoc} from '@atlas/contracts'
import {request} from '../../shared/api/http'
import {listProjects,createProject,loadDocument,saveDocument,exportProject,importProject,listDocumentVersions,loadDocumentVersion} from './api'
vi.mock('../../shared/api/http',()=>({request:vi.fn()}))
beforeEach(()=>vi.mocked(request).mockResolvedValue({version:4} as never))
describe('Contratos HTTP de proyectos',()=>{
 it('lista usando el workspace codificado',async()=>{
  await listProjects('w/1')
  expect(request).toHaveBeenCalledWith('/workspaces/w%2F1/projects')
 })
 it('crea proyecto con documento y nombre',async()=>{
  const doc=emptyDoc()
  await createProject('w1','ATLAS',doc)
  expect(request).toHaveBeenCalledWith('/workspaces/w1/projects',{method:'POST',body:JSON.stringify({name:'ATLAS',document:doc})})
 })
 it('carga y guarda con control de versión optimista',async()=>{
  const doc=emptyDoc()
  await loadDocument('proj/test')
  expect(request).toHaveBeenCalledWith('/projects/proj%2Ftest/document')
  const saved=await saveDocument('proj/test',doc,3)
  expect(saved).toBe(4)
  expect(request).toHaveBeenCalledWith('/projects/proj%2Ftest/document',{method:'PUT',body:JSON.stringify({document:doc,expectedVersion:3})})
 })
 it('exporta, importa y consulta historial de versiones',async()=>{
  await exportProject('p1')
  expect(request).toHaveBeenCalledWith('/projects/p1/export')
  const doc=emptyDoc()
  expect(await importProject('p1',doc,7)).toBe(4)
  expect(request).toHaveBeenCalledWith('/projects/p1/import',{method:'POST',body:JSON.stringify({document:doc,expectedVersion:7})})
  await listDocumentVersions('p1')
  expect(request).toHaveBeenCalledWith('/projects/p1/versions')
  await loadDocumentVersion('p1',2)
  expect(request).toHaveBeenCalledWith('/projects/p1/versions/2')
 })
})
