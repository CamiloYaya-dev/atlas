import {readFileSync} from 'node:fs'
import {emptyDoc,createElement,canonicalUmlEdge} from '@atlas/contracts'
import type {DiagramType,ElementType,ProjectDocument} from '@atlas/contracts'
export const examples: [DiagramType,ElementType,ElementType,string][]=[
 ['uml-class','uml-class','uml-interface','realization'],['uml-object','uml-object','uml-object','link'],['uml-component','component','uml-interface','realization'],['uml-composite','uml-part','uml-reference-role','connector'],['uml-deployment','uml-device','uml-node','communication-path'],['uml-package','uml-package','uml-package','import'],['uml-profile','uml-stereotype','uml-metaclass','extension'],['uml-usecase','actor','usecase','association'],['uml-activity','uml-start','uml-action','control-flow'],['uml-state','uml-start','uml-state','transition'],['uml-sequence','uml-lifeline','uml-lifeline','message'],['uml-communication','actor','uml-object','message'],['uml-interaction-overview','uml-start','uml-interaction','control-flow'],['uml-timing','uml-lifeline','uml-state','timing-transition']]
export function scopedFixture(type:DiagramType):ProjectDocument{
 if(type==='uml-component')return JSON.parse(readFileSync(new URL('./ATLAS_QA_UML_COMPONENTES.json',import.meta.url),'utf8'))
 if(type==='uml-sequence')return JSON.parse(readFileSync(new URL('./ATLAS_QA_UML_SECUENCIA.json',import.meta.url),'utf8'))
 if(type==='uml-activity')return JSON.parse(readFileSync(new URL('./ATLAS_QA_UML_ACTIVIDADES.json',import.meta.url),'utf8'))
 if(type==='uml-usecase')return JSON.parse(readFileSync(new URL('./ATLAS_QA_UML_CASOS_DE_USO.json',import.meta.url),'utf8'))
 if(type==='uml-class')return JSON.parse(readFileSync(new URL('./ATLAS_QA_UML_CLASES.json',import.meta.url),'utf8'))
 const row=examples.find(x=>x[0]===type);if(!row)throw Error(`Diagrama no registrado: ${type}`)
 const [,a,b,kind]=row,doc=emptyDoc();for(const [id,t] of [['a',a],['b',b]] as const)doc.elements[id]={...createElement(`QA ${id}`,t),id}
 doc.diagrams.push({id:'d',type,name:'QA UML',description:'',createdAt:'2026-11-16',nodes:[{id:'na',elementId:'a',x:20,y:20},{id:'nb',elementId:'b',x:500,y:20}],edges:[canonicalUmlEdge(type,{id:'r',source:'na',target:'nb',relationKind:kind})]});return JSON.parse(JSON.stringify(doc))
}
