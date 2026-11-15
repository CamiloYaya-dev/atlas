import {describe,it,expect} from 'vitest'
import {fireEvent,render,screen} from '@testing-library/react'
import {demoDocument} from '@atlas/fixtures'
import AdvancedExportFields,{defaultExportChoices,normalizeChoices} from './AdvancedExportFields'
describe('exportación avanzada del inspector',()=>{
 it('presenta opciones por caja y permite enviar un campo al diccionario',()=>{
  const doc=demoDocument(),diagram=doc.diagrams[0],choices=defaultExportChoices(doc,diagram)
  const node=diagram.nodes[0],name=doc.elements[node.elementId].name
  let result=choices
  render(<AdvancedExportFields doc={doc} diagram={diagram} mode="both" choices={choices} onChange={next=>{result=next}}/>)
  const dropdown=screen.getByRole('combobox',{name:`Exportación · ${name} · Resumen`})
  fireEvent.change(dropdown,{target:{value:'dictionary'}})
  expect(result[node.id]?.summary).toBe('dictionary')
 })
 it('al elegir modo exclusivo no conserva destinos incompatibles',()=>{
  const current={user:{summary:'embed' as const,owner:'dictionary' as const}}
  expect(normalizeChoices(current,'dictionary')).toEqual({user:{summary:'omit',owner:'dictionary'}})
 })
})

it('aplica las tres selecciones masivas sin incluir campos vacíos ni cajas inexistentes',()=>{
 const doc=demoDocument(),diagram=structuredClone(doc.diagrams[0]);diagram.nodes.push({id:'missing',elementId:'missing',x:0,y:0});let result=defaultExportChoices(doc,diagram)
 expect(result.missing).toBeUndefined();const change=(next:typeof result)=>{result=next}
 render(<AdvancedExportFields doc={doc} diagram={diagram} mode="both" choices={{}} onChange={change}/> )
 for(const [name,destination] of [['Todos en imagen','embed'],['Todos a las fichas','dictionary'],['Omitir todos','omit']] as const){
  fireEvent.click(screen.getByRole('button',{name}));expect(result.missing).toBeUndefined();expect(result[diagram.nodes[0].id].summary).toBe(destination);expect(Object.values(result).flatMap(Object.values).every(v=>v===destination||v==='omit')).toBe(true)
 }
})
it('normaliza cada destino para los cuatro modos y no muta elecciones',()=>{
 const choices={a:{x:'embed' as const,y:'dictionary' as const,z:'omit' as const}}
 expect(normalizeChoices(choices,'simple')).toEqual({a:{x:'omit',y:'omit',z:'omit'}})
 expect(normalizeChoices(choices,'embedded')).toEqual({a:{x:'embed',y:'omit',z:'omit'}})
 expect(normalizeChoices(choices,'both')).toEqual(choices)
 expect(choices.a.y).toBe('dictionary')
 const doc=demoDocument(),diagram=doc.diagrams[0];render(<AdvancedExportFields doc={doc} diagram={diagram} mode="dictionary" choices={{}} onChange={()=>{}}/>);expect(screen.queryByRole('button',{name:'Todos en imagen'})).toBeNull()
})
