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

it('diagnóstico de removeChild conserva la traza y se puede copiar sin borrar datos',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});const BrokenDOM=()=>{throw new DOMException('Failed to execute removeChild','NotFoundError')}
 const original=Object.getOwnPropertyDescriptor(navigator,'clipboard'),writeText=vi.fn().mockResolvedValue(undefined)
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
 try{render(<ErrorBoundary><BrokenDOM/></ErrorBoundary>);expect(screen.getByText(/traducción automática/)).toBeTruthy();screen.getByRole('button',{name:'Copiar diagnóstico'}).click();expect(writeText).toHaveBeenCalledWith(expect.stringContaining('removeChild'))}finally{if(original)Object.defineProperty(navigator,'clipboard',original);else Reflect.deleteProperty(navigator,'clipboard')}
})

it('diagnóstico tolera un error sin stack ni portapapeles e invoca la recarga solicitada',async()=>{
 const {Children,isValidElement}=await import('react');const component=new ErrorBoundary({children:null});const error=new Error('Sin traza');error.stack=undefined;component.state={error,stack:''}
 const find=(node:unknown,label:string):{onClick:()=>void}|undefined=>{if(!isValidElement(node))return undefined;const p=node.props as {children?:import('react').ReactNode;onClick?:()=>void};if(node.type==='button'&&p.children===label&&p.onClick)return {onClick:p.onClick};for(const child of Children.toArray(p.children)){const found=find(child,label);if(found)return found}return undefined}
 const tree=component.render(),copy=find(tree,'Copiar diagnóstico'),reload=find(tree,'Recargar');expect(copy).toBeTruthy();expect(reload).toBeTruthy()
 const refresh=vi.fn();try{vi.stubGlobal('navigator',{});vi.stubGlobal('window',{location:{reload:refresh}});copy!.onClick();reload!.onClick();expect(refresh).toHaveBeenCalledOnce()}finally{vi.unstubAllGlobals()}
})

it('si React no aporta el stack de componentes, mantiene el diagnóstico del error original',()=>{
 const component=new ErrorBoundary({children:null});const error=new Error('Diagnóstico sin stack de componentes');const update=vi.spyOn(component,'setState').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});component.componentDidCatch(error,{componentStack:null});expect(update).toHaveBeenCalledWith({stack:''})
})
