import {it} from 'vitest'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {Position,ReactFlowProvider} from '@xyflow/react'
import type {EdgeProps} from '@xyflow/react'
import {emptyDoc,createElement} from '@atlas/contracts'
import type {Diagram} from '@atlas/contracts'
import {AtlasUmlEdge,Terminal,terminalAngle,umlRelationAdornment} from './AtlasUmlEdge'
import VersionDiagramPreview from '../../features/projects/VersionDiagramPreview'

const props=(data:Record<string,unknown>={},override:Record<string,unknown>={})=>({id:'relacion',source:'a',target:'b',sourceX:60,sourceY:80,targetX:360,targetY:180,sourcePosition:Position.Right,targetPosition:Position.Left,data, ...override} as unknown as EdgeProps)
const edge=(data:Record<string,unknown>,extra:Record<string,unknown>={})=>renderToStaticMarkup(<ReactFlowProvider><svg><AtlasUmlEdge {...props(data,extra)}/></svg></ReactFlowProvider>)
const fixture=(kind:'c4'|'uml-class'|'uml-usecase'|'uml-activity'|'uml-sequence'|'uml-deployment'|'uml-component')=>{
 const doc=emptyDoc(),a=createElement('Servicio de reportes IA','component'),b=createElement('Cliente','actor');a.id='service';b.id='client';doc.elements.service=a;doc.elements.client=b
 const diagram:Diagram={id:'diagram',name:'Revisión QA',type:kind,description:'',createdAt:'2026-11-16',nodes:[{id:'a',elementId:'service',x:0,y:0},{id:'b',elementId:'client',x:400,y:180}],edges:[{id:'r',source:'a',target:'b',relationKind:'dependency',label:'Solicita'}]}
 doc.diagrams=[diagram]
 return {doc,diagram}
}

it('Vista histórica: C4 conserva enlaces y etiquetas autorizadas sin modificar el documento',()=>{
 const {doc,diagram}=fixture('c4'),before=structuredClone(doc)
 const html=renderToStaticMarkup(<VersionDiagramPreview document={doc} diagram={diagram}/>)
 assert.match(html,/Vista histórica del diagrama Revisión QA/);assert.match(html,/Servicio de reportes IA/);assert.match(html,/Cliente/);assert.match(html,/Solicita/)
 assert.match(html,/<line/);assert.deepEqual(doc,before)
})
it('Vista histórica: documento sin cajas, referencias huérfanas y rótulos largos no generan excepciones',()=>{
 const {doc,diagram}=fixture('c4');diagram.nodes=[]
 let html=renderToStaticMarkup(<VersionDiagramPreview document={doc} diagram={diagram}/>)
 assert.match(html,/Esta revisión no contiene cajas/);assert.doesNotMatch(html,/<line/)
 diagram.nodes=[{id:'a',elementId:'service',x:0,y:0},{id:'hidden',elementId:'missing',x:400,y:0}]
 doc.elements.service.name='Un nombre extraordinariamente largo para el servicio de reportes automatizados'
 html=renderToStaticMarkup(<VersionDiagramPreview document={doc} diagram={diagram}/>)
 assert.match(html,/…/);assert.doesNotMatch(html,/undefined/);assert.doesNotMatch(html,/<line/)
})
it('Vista histórica: notación UML clases, casos, actividades y secuencia usa escenas específicas',()=>{
 for(const kind of ['uml-class','uml-usecase','uml-activity','uml-sequence'] as const){
  const {doc,diagram}=fixture(kind);const html=renderToStaticMarkup(<VersionDiagramPreview document={doc} diagram={diagram}/>);assert.match(html,/Vista histórica del diagrama/);assert.match(html,/<svg/);assert.doesNotMatch(html,/NaN|Infinity/,kind)
 }
})
it('Terminales: ángulos cardinales y glifos semánticos se mantienen en la salida SVG',()=>{
 assert.equal(terminalAngle('right',0,0,50,0),0);assert.equal(terminalAngle('left',0,0,50,0),180);assert.equal(terminalAngle('top',0,0,0,-30),-90);assert.equal(terminalAngle('bottom',0,0,0,30),90)
 assert.equal(terminalAngle(undefined,0,0,0,10),90)
 assert.equal(renderToStaticMarkup(<svg><Terminal kind="none" x={0} y={0} angle={0}/><Terminal kind="assembly" x={0} y={0} angle={0}/></svg>),'<svg></svg>')
 for(const kind of ['diamond-open','diamond-filled','triangle','extension','open-arrow','filled-arrow','ball','socket','ownership','cross'] as const){const html=renderToStaticMarkup(<svg><Terminal kind={kind} x={12} y={24} angle={90}/></svg>);assert.match(html,new RegExp(`data-uml-terminal="${kind}"`))}
 assert.deepEqual(umlRelationAdornment('composition'),{start:'composition',end:'none',dash:false})
 assert.deepEqual(umlRelationAdornment('realization'),{start:'none',end:'triangle',dash:true})
 assert.equal(umlRelationAdornment('assembly').end,'ball-socket')
})
it('Aristas: generalización, asociación, respuesta y flechas de interfaces renderizan terminales y trazos',()=>{
 const general=edge({diagramType:'uml-class',relationKind:'generalization'});assert.match(general,/data-uml-terminal="triangle"/)
 const assoc=edge({diagramType:'uml-class',relationKind:'association',sourceNavigability:'non-navigable',targetNavigability:'navigable',sourceRole:'origen',targetRole:'destino'});assert.match(assoc,/data-uml-terminal="cross"/);assert.match(assoc,/data-uml-terminal="open-arrow"/)
 const reply=edge({diagramType:'uml-sequence',relationKind:'reply'});assert.match(reply,/stroke-dasharray:7 5/)
 const deploy=edge({diagramType:'uml-deployment',relationKind:'deployment'});assert.match(deploy,/stroke-dasharray:7 5/)
 const annotation=edge({diagramType:'uml-class',relationKind:'annotation',annotationPoint:{x:185,y:90}});assert.match(annotation,/L 185 90/);assert.doesNotMatch(annotation,/data-uml-terminal=/)
})
it('Aristas: n-arias, extensión de asociación, interruptor y puertos de estructura compuesta',()=>{
 const nary=edge({diagramType:'uml-class',relationKind:'association',extraEnds:[{id:'tercer',x:200,y:260,label:'Participante',navigability:'navigable',side:'bottom'},{id:'cuarto',x:100,y:300,label:'Espectador',navigability:'non-navigable',side:'left'}],associationClassPoint:{x:350,y:320}})
 assert.match(nary,/Participante/);assert.match(nary,/Espectador/);assert.match(nary,/data-uml-association-class="true"/);assert.match(nary,/data-uml-terminal="open-arrow"/);assert.match(nary,/data-uml-terminal="cross"/)
 const interrupted=edge({diagramType:'uml-activity',relationKind:'control-flow',activityInterrupted:true});assert.match(interrupted,/data-activity-interrupt="true"/)
 const exception=edge({diagramType:'uml-activity',relationKind:'exception-handler',activityInterrupted:true});assert.doesNotMatch(exception,/data-activity-interrupt=/)
 const connector=edge({diagramType:'uml-composite',relationKind:'connector',sourceElementType:'uml-port',targetElementType:'uml-part'});assert.equal((connector.match(/data-uml-terminal="port-square"/g)||[]).length,2)
 const note=edge({diagramType:'uml-usecase',relationKind:'extend',extensionNote:['Condición de usuario']});assert.match(note,/data-uml-note-anchor="true"/)
})
it('Aristas: ensamblaje de componentes deriva una bola y socket centrales sin duplicarlos al invertir orientación',()=>{
 const forward=edge({diagramType:'uml-component',relationKind:'assembly',componentAssembly:'forward'})
 const reverse=edge({diagramType:'uml-component',relationKind:'assembly',componentAssembly:'reverse'})
 assert.match(forward,/data-uml-terminal="assembly"/);assert.match(forward,/atlas-assembly-gap-relacion/)
 assert.match(reverse,/data-uml-terminal="assembly"/);assert.notEqual(forward,reverse)
 const rejected=edge({diagramType:'uml-component',relationKind:'assembly',componentAssembly:undefined})
 assert.doesNotMatch(rejected,/data-uml-terminal="assembly"/)
})
it('Aristas: geometría explícita de secuencia mantiene marcas y oculta terminales ajenos',()=>{
 const html=edge({sequenceGeometry:{path:'M 60 80 L 360 80',dash:'8 4',marks:'<circle data-seq-mark="true" cx="360" cy="80" r="5"/>',label:'solicitar',labelX:190,labelY:70}})
 assert.match(html,/data-seq-mark="true"/);assert.match(html,/stroke-dasharray:8 4/)
 assert.doesNotMatch(html,/data-uml-terminal=/)
})
it('Aristas: rutas paralelas, autorrelación y tipo vacío preservan geometría sin exponer nodos inexistentes',()=>{
 const defaults=renderToStaticMarkup(<ReactFlowProvider><svg><AtlasUmlEdge {...props({}, {data:undefined})}/></svg></ReactFlowProvider>)
 assert.match(defaults,/class="react-flow__edge-path"/)
 const self=edge({diagramType:'uml-class',relationKind:'association',parallelOffset:15,parallelPath:'bezier'}, {source:'a',target:'a',sourceX:100,sourceY:100,targetX:100,targetY:100})
 assert.match(self,/ C /);assert.doesNotMatch(self,/NaN|Infinity/)
 const parallel=edge({diagramType:'custom',relationKind:'dependency',parallelOffset:-25,parallelPath:'smoothstep'});assert.match(parallel,/react-flow__edge-path/);assert.doesNotMatch(parallel,/NaN|Infinity/)
 const classic=edge({diagramType:'uml-component',relationKind:'dependency',parallelOffset:10});assert.match(classic,/stroke-dasharray:7 5/)
})
it('Aristas: etiquetas reservadas, etiquetas propias y multiplicidades no alteran los extremos reales',()=>{
 const deploy=edge({diagramType:'uml-deployment',relationKind:'deployment',semanticDisplayLabel:'«deploy» backend',sourceMultiplicity:'1',targetMultiplicity:'0..*',sourceRole:'host',targetRole:'artefacto'})
 assert.match(deploy,/react-flow__edge-path/);assert.match(deploy,/data-uml-terminal="open-arrow"/)
 const guessed=edge({diagramType:'uml-deployment',relationKind:'deployment',semanticDisplayLabel:'texto libre'})
 assert.match(guessed,/data-uml-terminal="open-arrow"/)
 const normal=edge({diagramType:'uml-class',relationKind:'aggregation',sourceRole:'todo',targetMultiplicity:'*'})
 assert.match(normal,/data-uml-terminal="diamond-open"/)
 const classComposition=edge({diagramType:'uml-class',relationKind:'composition',wholeEnd:'source',targetMultiplicity:'*'})
 assert.match(classComposition,/data-uml-terminal="diamond-filled"/)
})
it('Aristas: ramas alternativas de conjuntos n-arios y conectores sin cuadrados',()=>{
 const component=edge({diagramType:'uml-component',relationKind:'dependency',extraEnds:[{id:'extra',x:100,y:120,label:'componente',navigability:'unspecified'}]})
 assert.match(component,/componente/);assert.match(component,/<circle/)
 const partiallyTyped=edge({diagramType:'uml-composite',relationKind:'delegation',sourceElementType:'uml-part',targetElementType:'uml-class'})
 assert.equal((partiallyTyped.match(/data-uml-terminal="port-square"/g)||[]).length,1)
 const other=edge({diagramType:'uml-composite',relationKind:'dependency',sourceElementType:'uml-port',targetElementType:'uml-part'})
 assert.doesNotMatch(other,/data-uml-terminal="port-square"/)
 assert.equal(umlRelationAdornment('aggregation').start,'aggregation')
})
it('Vista histórica: C4 vacío muestra un lienzo de tamaño predeterminado y UML vacío indica ausencia',()=>{
 const {doc,diagram}=fixture('c4');diagram.edges=[];diagram.nodes=[]
 const html=renderToStaticMarkup(<VersionDiagramPreview document={doc} diagram={diagram}/>);assert.match(html,/viewBox="-48 -48 696 376"/)
 const u=fixture('uml-class');u.diagram.nodes=[];u.diagram.edges=[]
 const preview=renderToStaticMarkup(<VersionDiagramPreview document={u.doc} diagram={u.diagram}/>);assert.match(preview,/Esta revisión no contiene cajas/)
})
