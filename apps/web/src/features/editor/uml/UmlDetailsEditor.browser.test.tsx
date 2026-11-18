import {render,screen,fireEvent} from '@testing-library/react'
import {useState} from 'react'
import {it,expect,vi} from 'vitest'
import {createElement} from '@novzi/contracts'
import type {ModelElement} from '@novzi/contracts'
import UmlDetailsEditor from './UmlDetailsEditor'
function fixture(type:ModelElement['type']){return createElement('Elemento QA',type)}
function Harness({initial,disabled=false,onChange,catalog}:{initial:ModelElement;catalog?:Record<string,ModelElement>;disabled?:boolean;onChange?:(uml:NonNullable<ModelElement['uml']>)=>void}){
 const [element,setElement]=useState(initial)
 return <><UmlDetailsEditor element={element} catalog={catalog} disabled={disabled} onChange={uml=>{setElement(e=>({...e,uml}));onChange?.(uml)}}/><output data-testid="uml-model">{JSON.stringify(element.uml||{})}</output></>
}
const change=(prefix:string,value:string)=>fireEvent.change(screen.getByLabelText(new RegExp('^'+prefix)),{target:{value}})
const model=()=>JSON.parse(screen.getByTestId('uml-model').textContent||'{}')
it('clase: CRUD de atributos, tipos, visibilidad, multiplicidad y longitud persiste datos',()=>{
 render(<Harness initial={fixture('uml-class')}/>);fireEvent.click(screen.getByRole('button',{name:'Atributo'}));change('Nombre atributo','saldo');change('Tipo atributo','Decimal');change('Longitud atributo','12');change('Visibilidad atributo','protected');change('Multiplicidad atributo','0..1');change('Valor inicial atributo','0')
 expect(model().attributes).toEqual([{id:expect.any(String),name:'saldo',type:'Decimal',visibility:'protected',length:12,multiplicity:'0..1',defaultValue:'0'}]);change('Longitud atributo','');expect(model().attributes[0].length).toBeUndefined();fireEvent.click(screen.getByRole('button',{name:'Quitar atributo saldo'}));expect(model().attributes).toEqual([])
})
it('operación: agrega/edita/elimina parámetros y preserva visibilidad y retorno',()=>{
 render(<Harness initial={fixture('uml-interface')}/>);fireEvent.click(screen.getByRole('button',{name:'Operación'}));change('Nombre operación','consultar');change('Retorno operación','Boolean');expect(screen.getByLabelText(/^Visibilidad operación /).querySelector('option[value="private"]')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Parámetro'}));change('Nombre parámetro','id');change('Tipo parámetro','UUID')
 expect(model().operations[0]).toMatchObject({name:'consultar',returnType:'Boolean',visibility:'public',parameters:[{name:'id',type:'UUID'}]});fireEvent.click(screen.getByRole('button',{name:'Quitar parámetro id'}));expect(model().operations[0].parameters).toEqual([]);fireEvent.click(screen.getByRole('button',{name:'Quitar operación'}));expect(model().operations).toEqual([])
})
it('objeto: clasificador y valores concretos se guardan y pueden quitarse',()=>{
 render(<Harness initial={fixture('uml-object')}/>);change('Clase de la instancia','Cuenta');fireEvent.click(screen.getByRole('button',{name:'Valor'}));change('Atributo slot','saldo');change('Tipo slot','Decimal');change('Valor slot','100');expect(model()).toMatchObject({classifier:'Cuenta',slots:[{name:'saldo',type:'Decimal',value:'100'}]});fireEvent.click(screen.getByRole('button',{name:'Quitar valor'}));expect(model()).toMatchObject({classifier:'Cuenta',slots:[]})
})
it('lector: puede consultar estructura pero no mutar atributos, operaciones ni parámetros',()=>{
 const onChange=vi.fn();render(<Harness initial={{...fixture('uml-class'),uml:{attributes:[{id:'a',name:'saldo',type:'Integer',visibility:'private'}],operations:[{id:'o',name:'pagar',returnType:'void',visibility:'public',parameters:[{id:'p',name:'id',type:'String'}]}]}}} disabled onChange={onChange}/>);
 const controls=[...document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('.uml-properties input,.uml-properties select,.uml-properties button')];expect(controls.length).toBeGreaterThan(10);expect(controls.every(el=>el.disabled)).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Atributo'}));expect(onChange).not.toHaveBeenCalled()
})
it('tipos sin estructura UML no muestran controles',()=>{
 const {container}=render(<UmlDetailsEditor element={fixture('activity')} disabled={false} onChange={vi.fn()}/>);expect(container.firstChild).toBeNull()
})
it('editar o quitar una fila de una clase no cambia las demás filas ni sus identificadores',()=>{
 const initial={...fixture('uml-class'),uml:{attributes:[{id:'a',name:'saldo',type:'Integer',visibility:'private' as const},{id:'b',name:'moneda',type:'String',visibility:'public' as const}],operations:[{id:'o1',name:'pagar',returnType:'void',visibility:'public' as const,parameters:[{id:'p1',name:'monto',type:'Decimal'},{id:'p2',name:'moneda',type:'String'}]},{id:'o2',name:'consultar',returnType:'Boolean',visibility:'private' as const,parameters:[]}]}}
 render(<Harness initial={initial}/>)
 fireEvent.change(screen.getByLabelText('Nombre atributo b'),{target:{value:'divisa'}})
 fireEvent.change(screen.getByLabelText('Tipo parámetro p2'),{target:{value:'Currency'}})
 fireEvent.change(screen.getByLabelText('Retorno operación o2'),{target:{value:'Saldo'}})
 expect(model().attributes[0]).toEqual(initial.uml.attributes[0]);expect(model().attributes[1]).toMatchObject({id:'b',name:'divisa'})
 expect(model().operations[0].parameters[0]).toEqual(initial.uml.operations[0].parameters[0]);expect(model().operations[0].parameters[1]).toMatchObject({id:'p2',type:'Currency'})
 expect(model().operations[1]).toMatchObject({id:'o2',returnType:'Saldo'})
 fireEvent.click(screen.getByRole('button',{name:'Quitar parámetro moneda'}));expect(model().operations[0].parameters).toEqual([initial.uml.operations[0].parameters[0]])
 fireEvent.click(screen.getByRole('button',{name:'Quitar atributo divisa'}));expect(model().attributes).toEqual([initial.uml.attributes[0]])
})
it('T01 enum edita literales independientes; atributos nuevos son readOnly',()=>{
 render(<Harness initial={fixture('uml-enumeration')}/>);fireEvent.click(screen.getByRole('button',{name:/Literal$/}));expect(model().literals).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Atributo'}));expect(model().attributes[0].readOnly).toBe(true)
})
it('T01 primitivo no ofrece atributos; señal no ofrece operaciones',()=>{const {rerender}=render(<UmlDetailsEditor element={fixture('uml-primitive')} disabled={false} onChange={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Atributo'})).toBeNull();rerender(<UmlDetailsEditor element={fixture('uml-signal')} disabled={false} onChange={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Operación'})).toBeNull()})

it('AUD-CL-001 clase permite visibilidad privada y solo clasificadores para referencias',()=>{
 const valid={...fixture('uml-datatype'),id:'value',name:'Dinero'}, invalid={...fixture('uml-package'),id:'package',name:'Paquete'};render(<Harness initial={fixture('uml-class')} catalog={{value:valid,package:invalid}}/>);fireEvent.click(screen.getByRole('button',{name:'Atributo'}));const select=screen.getByLabelText('Referencia de tipo');expect(select.querySelector('option[value="package"]')).toBeNull();fireEvent.change(select,{target:{value:'value'}});expect(model().attributes[0]).toMatchObject({typeId:'value',type:'Dinero'});fireEvent.click(screen.getByRole('button',{name:'Operación'}));change('Visibilidad operación','private');expect(model().operations[0].visibility).toBe('private');fireEvent.click(screen.getByRole('button',{name:'Parámetro formal'}));expect(screen.getByLabelText('Tipo formal referenciado').querySelector('option[value="package"]')).toBeNull();fireEvent.change(screen.getByLabelText('Tipo formal referenciado'),{target:{value:'value'}});expect(model().templateParameters[0].typeId).toBe('value')
})

it('AUD-CL-UX parámetro inválido permanece local y al corregirlo persiste sin perder los demás campos',()=>{
 const onChange=vi.fn(),initial={...fixture('uml-class'),uml:{operations:[{id:'o',name:'pagar',returnType:'Boolean',visibility:'public' as const,parameters:[{id:'p',name:'monto',type:'Decimal',multiplicity:'1'}]}]}};render(<Harness initial={initial} onChange={onChange}/>);const field=screen.getByLabelText('Multiplicidad parámetro p') as HTMLInputElement;
 fireEvent.change(field,{target:{value:'1..'}});expect(field.value).toBe('1..');expect(field.getAttribute('aria-invalid')).toBe('true');expect(screen.getByRole('alert').textContent).toContain('Multiplicidad inválida');expect(onChange).not.toHaveBeenCalled();expect(model().operations[0].parameters[0].multiplicity).toBe('1');fireEvent.change(screen.getByLabelText('Nombre parámetro p'),{target:{value:'importe'}});expect(model().operations[0].parameters[0].name).toBe('importe');expect(field.value).toBe('1..');fireEvent.change(field,{target:{value:'1..*'}});expect(field.getAttribute('aria-invalid')).toBe('false');expect(screen.queryByRole('alert')).toBeNull();expect(model().operations[0].parameters[0]).toMatchObject({name:'importe',multiplicity:'1..*'});
})
it('AUD-CL-UX nombre vacío no contamina el modelo; múltiples parámetros conservan IDs y región desplazable',()=>{
 render(<Harness initial={fixture('uml-class')}/>);fireEvent.click(screen.getByRole('button',{name:'Operación'}));fireEvent.click(screen.getByRole('button',{name:'Parámetro'}));fireEvent.click(screen.getByRole('button',{name:'Parámetro'}));const params=model().operations[0].parameters;expect(params.map((p:{name:string})=>p.name)).toEqual(['parametro','parametro2']);expect(params[0].id).not.toBe(params[1].id);const region=screen.getByRole('region',{name:'Campos del parámetro parametro'});expect(region.classList.contains('uml-parameter-scroll')).toBe(true);expect(region.getAttribute('tabindex')).toBe('0');const input=screen.getByLabelText('Nombre parámetro '+params[0].id) as HTMLInputElement;fireEvent.change(input,{target:{value:''}});expect(input.value).toBe('');expect(model().operations[0].parameters[0].name).toBe('parametro');fireEvent.change(input,{target:{value:'monto'}});expect(model().operations[0].parameters[0].name).toBe('monto');expect(model().operations[0].parameters[1]).toEqual(params[1]);
})
it('AUD-CL-UX atributo no envía multiplicidad parcial durante escritura',()=>{const onChange=vi.fn();const initial={...fixture('uml-class'),uml:{attributes:[{id:'a',name:'saldo',type:'Integer',visibility:'private' as const,multiplicity:'1'}]}};render(<Harness initial={initial} onChange={onChange}/>);change('Multiplicidad atributo','0..');expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeTruthy();change('Multiplicidad atributo','0..1');expect(model().attributes[0].multiplicity).toBe('0..1');expect(screen.queryByRole('alert')).toBeNull()})
