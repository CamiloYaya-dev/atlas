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
