import {describe,it,expect,vi,beforeEach} from 'vitest'
import {emptyDoc} from '@atlas/contracts'
import {request,requestFile} from '../../shared/api/http'
import {listProjects,createProject,loadDocument,saveDocument,exportProject,importProject,listDocumentVersions,loadDocumentVersion,listRestoreBranches,createRestoreBranch,previewRestoreBranch,applyRestoreBranch,discardRestoreBranch,workspaceLicense,exportDiagramImage} from './api'
vi.mock('../../shared/api/http',()=>({request:vi.fn(),requestFile:vi.fn()}))
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
  expect(request).toHaveBeenCalledWith('/projects/proj%2Ftest/document',{method:'PUT',body:JSON.stringify({document:doc,expectedVersion:3,collaborative:true})})
 })
 it('entrega al editor el documento canónico cuando el servidor fusiona cambios',async()=>{
  const doc=emptyDoc()
  const onCommitted=vi.fn()
  vi.mocked(request).mockResolvedValueOnce({version:5,document:doc} as never)
  const saved=await saveDocument('p1',doc,4,onCommitted)
  expect(saved).toBe(5)
  expect(onCommitted).toHaveBeenCalledWith(doc,5)
  expect(request).toHaveBeenCalledWith('/projects/p1/document',{method:'PUT',body:JSON.stringify({document:doc,expectedVersion:4,collaborative:true})})
 })
 it('contrato HTTP de ramas: creación, consulta, vista previa, resolución y descarte',async()=>{
  await listRestoreBranches('p1')
  expect(request).toHaveBeenCalledWith('/projects/p1/restore-branches')
  await createRestoreBranch('p1',2)
  expect(request).toHaveBeenCalledWith('/projects/p1/restore-branches',{method:'POST',body:JSON.stringify({sourceVersion:2})})
  await previewRestoreBranch('p1','b1')
  expect(request).toHaveBeenCalledWith('/projects/p1/restore-branches/b1/preview')
  await applyRestoreBranch('p1','b1',3,'merge',{'document.elements.a.name':'historical'})
  expect(request).toHaveBeenCalledWith('/projects/p1/restore-branches/b1/apply',{method:'POST',body:JSON.stringify({expectedVersion:3,mode:'merge',resolutions:{'document.elements.a.name':'historical'}})})
  await discardRestoreBranch('p1','b1')
  expect(request).toHaveBeenCalledWith('/projects/p1/restore-branches/b1',{method:'DELETE'})
 })
 it('consulta los derechos de licencia y solicita un binario firmado al servidor',async()=>{
  await workspaceLicense('w/1')
  expect(request).toHaveBeenCalledWith('/workspaces/w%2F1/license')
  await exportDiagramImage('project/1','diagram/1','png',9,'cG5n')
  expect(requestFile).toHaveBeenCalledWith('/projects/project%2F1/diagrams/diagram%2F1/export-image',{format:'png',expectedVersion:9,imageBase64:'cG5n'})
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
