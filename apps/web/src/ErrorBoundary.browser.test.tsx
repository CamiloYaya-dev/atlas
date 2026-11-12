import {describe,it,expect,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'
const Broken=()=>{throw new Error('Error de ejemplo controlado')}
describe('Contención de fallos de React',()=>{
 it('renderiza contenido sano',()=>{
  render(<ErrorBoundary><p>Aplicación funcionando</p></ErrorBoundary>)
  expect(screen.getByText('Aplicación funcionando')).toBeTruthy()
 })
 it('ofrece diagnóstico legible ante un error de render',()=>{
  const error=vi.spyOn(console,'error').mockImplementation(()=>{})
  render(<ErrorBoundary><Broken/></ErrorBoundary>)
  expect(screen.getByRole('heading',{name:'La aplicación encontró un error'})).toBeTruthy()
  expect(screen.getByText(/Error de ejemplo controlado/)).toBeTruthy()
  expect(screen.getByRole('button',{name:'Recargar'})).toBeTruthy()
  error.mockRestore()
 })
})
