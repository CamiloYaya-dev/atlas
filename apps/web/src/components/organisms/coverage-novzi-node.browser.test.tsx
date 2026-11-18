import {it} from 'vitest'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {ReactFlowProvider} from '@xyflow/react'
import type {NodeProps} from '@xyflow/react'
import {createElement,activityDefaults} from '@novzi/contracts'
import type {DiagramType,ElementType,ModelElement,Perspective} from '@novzi/contracts'
import {NovziNode,IconFor,nodeTypes} from './NovziNode'

const renderNode=(graphType:DiagramType,element:ModelElement,extra:Record<string,unknown>={},selected=false)=>{
 const data={element,graphType,mode:'mixed' as Perspective,canResize:false,...extra}
 const props={id:'qa',data,selected} as unknown as NodeProps
 return renderToStaticMarkup(<ReactFlowProvider><NovziNode {...props}/></ReactFlowProvider>)
}
const item=(name:string,type:ElementType):ModelElement=>({...createElement(name,type),id:name.toLowerCase().replaceAll(' ','-')})

it('Nodos genéricos: las perspectivas funcional y técnica no revelan campos ajenos',()=>{
 const e=item('Reporte automático','component');e.summary='Descripción de negocio';e.technical='Backend IA';e.childDiagramId='child'
 const functional=renderNode('c3',e,{mode:'functional',linkedDiagramType:'c4'})
 assert.match(functional,/Descripción de negocio/);assert.doesNotMatch(functional,/Backend IA/);assert.match(functional,/Doble clic/)
 const technical=renderNode('c3',e,{mode:'technical',linkedDiagramType:'c4'})
 assert.match(technical,/Backend IA/);assert.doesNotMatch(technical,/Descripción de negocio/)
 const mixed=renderNode('c3',e,{mode:'mixed'})
 assert.match(mixed,/Descripción de negocio/);assert.match(mixed,/Backend IA/)
 for(const kind of ['c1','c2','c3','c4','process','data','trace','custom'] as const){const html=renderNode(kind,e);assert.match(html,/Reporte automático/);assert.doesNotMatch(html,/NaN|Infinity/)}
})
it('UML estructura: tipo semántico estable, atributos, operaciones, enumeración, plantilla y objetos',()=>{
 const cls=item('Factura','uml-class');cls.uml={abstract:true,leaf:false,attributes:[{id:'a',name:'total',visibility:'private',type:'Decimal',static:true}],operations:[{id:'o',name:'totalizar',visibility:'public',returnType:'Decimal',static:true,parameters:[]}],templateParameters:[{id:'p',name:'T'}]}
 const html=renderNode('uml-class',cls);assert.match(html,/«Abstract Class»/);assert.match(html,/totalizar/);assert.match(html,/total/);assert.match(html,/T/)
 const en=item('EstadoFactura','uml-enumeration');en.uml={literals:[{id:'ok',name:'Pagada'}]};assert.match(renderNode('uml-class',en),/Pagada/)
 const obj=item('factura: Factura','uml-object');obj.uml={classifier:'Factura',slots:[{id:'s',name:'total',value:'120'}]};assert.match(renderNode('uml-object',obj),/total = 120/)
 const absent=item('objeto','uml-object');assert.match(renderNode('uml-object',absent),/Sin valores de instancia/)
 const note=item('Nota','uml-comment');note.uml={note:'Archivo protegido'};assert.match(renderNode('uml-class',note),/Archivo protegido/)
 const constraint=item('Regla','uml-constraint');constraint.uml={expression:'total > 0'};assert.match(renderNode('uml-class',constraint),/total &gt; 0/)
})
it('UML actividades y estados: glifos de control preservan tipo y no se convierten en tarjetas',()=>{
 for(const type of ['uml-start','uml-end','uml-decision','uml-fork','uml-flow-final'] as const){
  const e=item(type,type);e.activityDetail=activityDefaults(type)
  const html=renderNode('uml-activity',e)
  assert.match(html,/novzi-uml-control/);assert.ok(html.includes(`kind-${type}`));assert.doesNotMatch(html,/class="novzi-node/)
 }
 for(const type of ['uml-history-shallow','uml-history-deep','uml-entry-point','uml-exit-point','uml-terminate','uml-start','uml-end','uml-decision','uml-fork'] as const){
  const html=renderNode('uml-state',item(type,type))
  assert.match(html,/novzi-uml-control/);assert.doesNotMatch(html,/class="novzi-node/)
 }
})
it('UML semántico: componente y despliegue mantienen el SVG propio y puertos de cubo',()=>{
 const e=item('Servicio IA','component')
 const c=renderNode('uml-component',e,{componentGlyph:'<rect data-component="true" width="80" height="60"/>',componentSize:{width:180,height:120}})
 assert.match(c,/data-component="true"/);assert.match(c,/top-3/);assert.match(c,/bottom-3/)
 const d=renderNode('uml-deployment',item('Servidor','uml-device'),{componentGlyph:'<polygon data-device="true" points="0,0 10,0 5,5"/>',componentSize:{width:200,height:140},deploymentCube:true})
 assert.match(d,/data-device="true"/);assert.match(d,/top-3/);assert.doesNotMatch(d,/NaN|Infinity/)
 const port=renderNode('uml-component',item('Puerto','uml-port'),{componentGlyph:'<rect data-port="true"/>',componentSize:{width:65,height:60}})
 assert.match(port,/data-port="true"/);assert.match(port,/top-2/);assert.doesNotMatch(port,/top-3/)
})
it('UML secuencia: símbolo de ejecución, destrucción y línea de vida usan conexiones laterales',()=>{
 for(const type of ['uml-activation','uml-destruction'] as const){const html=renderNode('uml-sequence',item(type,type));assert.match(html,/novzi-uml-control/);assert.ok(html.includes(`kind-${type}`))}
 const lifeline=renderNode('uml-sequence',item('Servicio IA','uml-lifeline'),{sequenceGlyph:'<line data-lifeline="true" x1="20" y1="0" x2="20" y2="200"/>',sequenceSize:{width:48,height:260}})
 assert.match(lifeline,/data-lifeline="true"/);assert.match(lifeline,/Ocurrencia left/)
 const activation=renderNode('uml-sequence',item('Activación','uml-activation'),{sequenceGlyph:'<rect data-activation="true"/>',sequenceSize:{width:48,height:260}})
 assert.match(activation,/data-activation="true"/);assert.match(activation,/Mensaje UML lateral izquierdo/)
})
it('Catálogo gráfico: íconos funcionales y vista de actividad conservan contratos de dibujo',()=>{
 for(const type of ['actor','system','database','endpoint','requirement','usecase','process','activity','external','no-definido']){
  const html=renderToStaticMarkup(<IconFor type={type}/>);assert.match(html,/<svg/);assert.doesNotMatch(html,/NaN|Infinity/)
 }
 const frame=nodeTypes['activity-frame']({data:{label:'Procesamiento'} as NodeProps['data']} as NodeProps)
 const html=renderToStaticMarkup(frame);assert.match(html,/Procesamiento/)
 assert.match(renderNode('uml-activity',item('Crear reporte','uml-action')),/Crear reporte/)
 assert.match(renderNode('uml-activity',item('Paquete','uml-object-node')),/Paquete/)
})
