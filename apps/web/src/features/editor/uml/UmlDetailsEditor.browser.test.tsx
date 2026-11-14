import {render,screen,fireEvent} from '@testing-library/react'
import {useState} from 'react'
import {it,expect,vi} from 'vitest'
import {createElement} from '@atlas/contracts'
import type {ModelElement} from '@atlas/contracts'
import UmlDetailsEditor from './UmlDetailsEditor'
function fixture(type:ModelElement['type']){return createElement('Elemento QA',type)}
function Harness({initial,disabled=false,onChange}:{initial:ModelElement;disabled?:boolean;onChange?:(uml:NonNullable<ModelElement['uml']>)=>void}){
 const [element,setElement]=useState(initial)
 return <><UmlDetailsEditor element={element} disabled={disabled} onChange={uml=>{setElement(e=>({...e,uml}));onChange?.(uml)}}/><output data-testid="uml-model">{JSON.stringify(element.uml||{})}</output></>
}
const change=(prefix:string,value:string)=>fireEvent.change(screen.getByLabelText(new RegExp('^'+prefix)),{target:{value}})
const model=()=>JSON.parse(screen.getByTestId('uml-model').textContent||'{}')
it('clase: CRUD de atributos, tipos, visibilidad, multiplicidad y longitud persiste datos',()=>{
 render(<Harness initial={fixture('uml-class')}/>);fireEvent.click(screen.getByRole('button',{name:'Atributo',exact:true}));change('Nombre atributo','saldo');change('Tipo atributo','Decimal');change('Longitud atributo','12');change('Visibilidad atributo','protected');change('Multiplicidad atributo','0..1');change('Valor inicial atributo','0')
 expect(model().attributes).toEqual([{id:expect.any(String),name:'saldo',type:'Decimal',visibility:'protected',length:12,multiplicity:'0..1',defaultValue:'0'}]);change('Longitud atributo','');expect(model().attributes[0].length).toBeUndefined();fireEvent.click(screen.getByRole('button',{name:'Quitar atributo saldo'}));expect(model().attributes).toEqual([])
})
it('operación: agrega/edita/elimina parámetros y preserva visibilidad y retorno',()=>{
 render(<Harness initial={fixture('uml-interface')}/>);fireEvent.click(screen.getByRole('button',{name:'Operación',exact:true}));change('Nombre operación','consultar');change('Retorno operación','Boolean');change('Visibilidad operación','private');fireEvent.click(screen.getByRole('button',{name:'Parámetro',exact:true}));change('Nombre parámetro','id');change('Tipo parámetro','UUID')
 expect(model().operations[0]).toMatchObject({name:'consultar',returnType:'Boolean',visibility:'private',parameters:[{name:'id',type:'UUID'}]});fireEvent.click(screen.getByRole('button',{name:'Quitar parámetro id'}));expect(model().operations[0].parameters).toEqual([]);fireEvent.click(screen.getByRole('button',{name:'Quitar operación'}));expect(model().operations).toEqual([])
})
it('objeto: clasificador y valores concretos se guardan y pueden quitarse',()=>{
 render(<Harness initial={fixture('uml-object')}/>);change('Clase de la instancia','Cuenta');fireEvent.click(screen.getByRole('button',{name:'Valor',exact:true}));change('Atributo slot','saldo');change('Tipo slot','Decimal');change('Valor slot','100');expect(model()).toMatchObject({classifier:'Cuenta',slots:[{name:'saldo',type:'Decimal',value:'100'}]});fireEvent.click(screen.getByRole('button',{name:'Quitar valor'}));expect(model()).toMatchObject({classifier:'Cuenta',slots:[]})
})
it('lector: puede consultar estructura pero no mutar atributos, operaciones ni parámetros',()=>{
 const onChange=vi.fn();render(<Harness initial={{...fixture('uml-class'),uml:{attributes:[{id:'a',name:'saldo',type:'Integer',visibility:'private'}],operations:[{id:'o',name:'pagar',returnType:'void',visibility:'public',parameters:[{id:'p',name:'id',type:'String'}]}]}}} disabled onChange={onChange}/>);
 const controls=[...document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.uml-properties input,.uml-properties select,.uml-properties button')];expect(controls.length).toBeGreaterThan(10);expect(controls.every(el=>el.disabled)).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Atributo',exact:true}));expect(onChange).not.toHaveBeenCalled()
})
it('tipos sin estructura UML no muestran controles',()=>{
 const {container}=render(<UmlDetailsEditor element={fixture('activity')} disabled={false} onChange={vi.fn()}/>);expect(container.firstChild).toBeNull()
})
