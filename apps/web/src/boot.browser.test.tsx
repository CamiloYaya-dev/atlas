import {beforeEach,describe,expect,it,vi} from 'vitest'

const {renderRoot,createRoot}=vi.hoisted(()=>{
 const renderRoot=vi.fn()
 return {renderRoot,createRoot:vi.fn(()=>({render:renderRoot}))}
})
vi.mock('react-dom/client',()=>({createRoot}))

// Dos ramas del punto real de arranque: sin #root debe fallar explícitamente;
// con #root debe montar React y envolver la aplicación en ErrorBoundary.
describe('Arranque real del frontend',()=>{
 beforeEach(()=>{vi.resetModules();createRoot.mockClear();renderRoot.mockClear();document.body.innerHTML=''})
 it('si falta #root, emite un error identificable en vez de una pantalla vacía',async()=>{
  await expect(import('./main')).rejects.toThrow('ATLAS: no se encontró el contenedor #root')
  expect(createRoot).not.toHaveBeenCalled()
 })
 it('monta la aplicación sobre #root dentro de StrictMode',async()=>{
  const mount=document.createElement('div');mount.id='root';document.body.appendChild(mount)
  await import('./main')
  expect(createRoot).toHaveBeenCalledWith(mount)
  expect(renderRoot).toHaveBeenCalledOnce()
  const rendered=renderRoot.mock.calls[0][0]
  expect(rendered.type).toBeDefined()
  expect(rendered.props.children).toBeDefined()
 })
})
