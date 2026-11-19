import {it,expect} from 'vitest'
import {render,screen} from '@testing-library/react'
import {emptyDoc,createElement} from '@novzi/contracts'
import type {Diagram} from '@novzi/contracts'
import VersionDiagramPreview from './VersionDiagramPreview'
it('una versión vacía no inventa cajas ni relaciones',()=>{
 const doc=emptyDoc(),diagram:Diagram={id:'d',name:'Vacío',description:'',createdAt:'2026-01-01',type:'c1',nodes:[],edges:[]}
 render(<VersionDiagramPreview diagram={diagram} document={doc}/>);expect(screen.getByRole('img',{name:'Vista histórica del diagrama Vacío'})).toBeTruthy();expect(screen.getByText(/no contiene cajas/)).toBeTruthy()
})
it('muestra etiquetas autorizadas, recorta nombres largos y omite extremos huérfanos',()=>{
 const doc=emptyDoc(),a=createElement('Nombre de un elemento particularmente largo','actor'),b=createElement('API','service');doc.elements[a.id]=a;doc.elements[b.id]=b
 const diagram:Diagram={id:'d',name:'Histórico',description:'',createdAt:'2026-01-01',type:'c1',nodes:[{id:'a',elementId:a.id,x:-50,y:20},{id:'b',elementId:b.id,x:400,y:40},{id:'orphan',elementId:'missing',x:0,y:0}],edges:[{id:'ok',source:'a',target:'b',label:'Consulta'},{id:'no-label',source:'b',target:'a'},{id:'ghost',source:'a',target:'missing',label:'No visible'}]}
 render(<VersionDiagramPreview diagram={diagram} document={doc}/>);const svg=screen.getByRole('img');expect(svg.querySelectorAll('rect')).toHaveLength(2);expect(svg.querySelectorAll('line')).toHaveLength(2);expect(screen.getByText(a.name.slice(0,24)+'…')).toBeTruthy();expect(screen.getByText('Consulta')).toBeTruthy();expect(screen.queryByText('No visible')).toBeNull()
})
