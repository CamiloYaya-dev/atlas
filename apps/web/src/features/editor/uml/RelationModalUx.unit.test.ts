import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error jsdom is provided by the local test runner without a declaration package
import {JSDOM} from 'jsdom'
import {createElement as element,emptyDoc} from '@atlas/contracts'
import {createElement} from 'react'
import {render,fireEvent,cleanup} from '@testing-library/react'
import ClassRelationDialog from './ClassRelationDialog'
import type {ProjectDocument} from '@atlas/contracts'

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node})
function sample():ProjectDocument{
 const doc=emptyDoc();const a=element('Política','uml-class'),b=element('Motor','uml-class'),c=element('Pasarela','uml-class')
 a.id='class-a';b.id='class-b';c.id='class-c';doc.elements={[a.id]:a,[b.id]:b,[c.id]:c}
 doc.diagrams=[{id:'cl',name:'Modelo de pagos',description:'',createdAt:'2026-11-17',type:'uml-class',nodes:[{id:'a',elementId:'class-a',x:0,y:0},{id:'b',elementId:'class-b',x:240,y:0},{id:'c',elementId:'class-c',x:480,y:0}],edges:[{id:'relation',source:'a',target:'b',relationKind:'dependency',pathStyle:'straight'}]}]
 return doc
}
test('modal UML permite cambiar destino sin borrar relación, con control accesible',()=>{
 const doc=sample(),onSave=(edge:unknown)=>{assert.ok(edge)}
 const {container,unmount}=render(createElement(ClassRelationDialog,{doc,diagram:doc.diagrams[0],initial:doc.diagrams[0].edges[0],onClose:()=>{},onSave}))
 const dest=container.querySelector<HTMLSelectElement>('select[aria-label="Cambiar destino UML"]')
 assert.ok(dest)
 assert.equal(dest.value,'b')
 fireEvent.change(dest,{target:{value:'c'}})
 assert.equal(dest.value,'c')
 assert.match(container.querySelector('.atlas-class-relation > p')?.textContent||'',/Política → Pasarela/)
 assert.equal(doc.diagrams[0].edges[0].target,'b')
 unmount();cleanup()
})
