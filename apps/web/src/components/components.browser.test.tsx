import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import {IconButton} from './atoms/IconButton'
import {StatusPill} from './atoms/StatusPill'
import {Overlay,Field} from './molecules/Overlay'
import {AtlasNode,IconFor} from './organisms/AtlasNode'
import {demoDocument} from '@atlas/fixtures'
import type {NodeProps} from '@xyflow/react'

vi.mock('@xyflow/react',()=>({
 Handle:({type}:{type:string})=><span data-testid={`handle-${type}`}/> ,
 Position:{Left:'left',Right:'right'}
}))

describe('Átomos, moléculas y caja gráfica',()=>{
 it('IconButton ejecuta la acción y mantiene atributos accesibles',()=>{
  const onClick=vi.fn()
  render(<IconButton aria-label="Abrir inspector" onClick={onClick}>i</IconButton>)
  const button=screen.getByRole('button',{name:'Abrir inspector'})
  expect(button.className).toContain('icon-btn')
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledOnce()
 })
 it('StatusPill representa tono neutro y positivo',()=>{
  const {rerender}=render(<StatusPill>Guardando</StatusPill>)
  expect(screen.getByText('Guardando').className).toContain('tone-neutral')
  rerender(<StatusPill tone="positive">Guardado</StatusPill>)
  expect(screen.getByText('Guardado').className).toContain('tone-positive')
 })
 it('Overlay se cierra desde fondo y botón, pero no desde contenido',()=>{
  const close=vi.fn()
  const {container}=render(<Overlay title="Configurar permisos" onClose={close} wide><p>Contenido</p></Overlay>)
  expect(screen.getByRole('heading',{name:'Configurar permisos'})).toBeTruthy()
  expect(screen.getByRole('dialog',{name:'Configurar permisos'}).getAttribute('aria-modal')).toBe('true')
  fireEvent.mouseDown(screen.getByText('Contenido'))
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}))
  fireEvent.mouseDown(container.querySelector('.overlay')!)
  expect(close).toHaveBeenCalledTimes(2)
 })
 it('Field vincula etiqueta, control y ayuda',()=>{
  render(<Field label="Resumen" hint="Obligatorio"><input aria-label="Resumen"/></Field>)
  expect(screen.getByText('Obligatorio')).toBeTruthy()
  expect(screen.getByRole('textbox',{name:'Resumen'})).toBeTruthy()
 })
 it('caja funcional omite detalle técnico y caja técnica lo incluye',()=>{
  const e=demoDocument().elements['endpoint-pay']
  const props={id:'node-1',type:'atlas',data:{element:e,mode:'functional',graphType:'c3'},selected:true}
  const {rerender}=render(<AtlasNode {...props as unknown as NodeProps}/>)
  expect(screen.getByText(e.name)).toBeTruthy()
  expect(screen.getByText(e.summary)).toBeTruthy()
  expect(screen.queryByText(e.technical||'')).toBeNull()
  rerender(<AtlasNode {...{...props,selected:false,data:{...props.data,mode:'technical'}} as unknown as NodeProps}/>)
  expect(screen.getByText(e.technical!)).toBeTruthy()
  expect(screen.queryByText(e.summary)).toBeNull()
 })
 it('caja de trazabilidad enseña tipo de vista, detalles técnicos y vínculo de profundización',()=>{
  const element=demoDocument().elements['platform']
  render(<AtlasNode {...{id:'node-platform',type:'atlas',selected:true,data:{element,mode:'mixed',graphType:'trace'}} as unknown as NodeProps}/>)
  expect(screen.getByText('Plataforma Zercano')).toBeTruthy()
  expect(screen.getByText('Matriz de trazabilidad')).toBeTruthy()
  expect(screen.getByText(element.technical!)).toBeTruthy()
  expect(document.querySelector('.atlas-node.selected')).not.toBeNull()
  expect(document.querySelector('.node-drill')).not.toBeNull()
 })
 it('IconFor cubre cada icono de negocio sin omitir tipos autorizados',()=>{
  const kinds=['actor','system','database','endpoint','requirement','usecase','process','activity','external','container','component','service','event','document']
  render(<div>{kinds.map(kind=><span data-testid={'icon-'+kind} key={kind}><IconFor type={kind}/></span>)}</div>)
  for(const kind of kinds)expect(screen.getByTestId('icon-'+kind).querySelector('svg')).not.toBeNull()
 })
 it('elemento faltante y catálogo de iconos son seguros',()=>{
  const {rerender}=render(<AtlasNode {...{data:{},selected:false} as unknown as NodeProps}/>)
  expect(screen.getByText('Elemento no disponible')).toBeTruthy()
  rerender(<><IconFor type="actor"/><IconFor type="database"/><IconFor type="desconocido"/></>)
  expect(document.querySelectorAll('svg')).toHaveLength(3)
 })
})
