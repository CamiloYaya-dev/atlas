import {it} from 'vitest'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {ReactFlowProvider} from '@xyflow/react'
import type {NodeProps} from '@xyflow/react'
import {createElement,activityDefaults} from '@novzi/contracts'
import type {DiagramType,ElementType,ModelElement,Perspective} from '@novzi/contracts'
import {NovziNode} from './NovziNode'

const e=(name:string,type:ElementType):ModelElement=>({...createElement(name,type),id:`qa-${name.replaceAll(' ','-')}`})
const html=(graphType:DiagramType,element:ModelElement|undefined,extra:Record<string,unknown>={},selected=false)=>{
 const data={element,graphType,mode:'mixed' as Perspective,canResize:false,...extra}
 const props={id:'node-qa',data,selected} as unknown as NodeProps
 return renderToStaticMarkup(<ReactFlowProvider><NovziNode {...props}/></ReactFlowProvider>)
}

it('Cajas inexistentes y perspectivas no revelan contenido técnico en la vista funcional',()=>{
 assert.match(html('c1',undefined),/Elemento no disponible/)
 const el=e('Panel de reportes','system');el.summary='Beneficio para negocio';el.technical='token confidencial';el.childDiagramId='x'
 const f=html('c1',el,{mode:'functional',linkedDiagramType:'c2'})
 assert.match(f,/Beneficio para negocio/);assert.doesNotMatch(f,/token confidencial/);assert.match(f,/C2/)
 const t=html('c1',el,{mode:'technical',linkedDiagramType:'process'})
 assert.match(t,/token confidencial/);assert.doesNotMatch(t,/Beneficio para negocio/)
 assert.match(t,/Doble clic para abrir/)
})

it('Casos de uso: actor símbolo, actor rectangular y sujeto con anclaje de anotación son diferentes',()=>{
 const actor=e('Profesional','actor')
 const stick=html('uml-usecase',actor);assert.match(stick,/uml-actor/);assert.doesNotMatch(stick,/NaN|Infinity/)
 actor.useCaseDetail={presentation:'rectangle'};const card=html('uml-usecase',actor)
 assert.match(card,/Profesional/);assert.notEqual(card,stick)
 const uc=e('Consultar informe','usecase');const oval=html('uml-usecase',uc)
 assert.match(oval,/Consultar informe/)
 uc.useCaseDetail={presentation:'rectangle'};assert.notEqual(html('uml-usecase',uc),oval)
 const subject=e('Plataforma','uml-subject')
 const marked=html('uml-usecase',subject,{ucAnnotationTarget:true});assert.match(marked,/uc-annotation/)
 assert.doesNotMatch(html('uml-usecase',subject),/uc-annotation/)
})

it('Clases, perfiles y modelos muestran tipo UML obligatorio sin usarlo como nombre editable',()=>{
 const cls=e('Reserva','uml-class');cls.uml={abstract:true,leaf:true,attributes:[{id:'a',name:'id',type:'String',visibility:'private'}]}
 const structural=html('uml-class',cls);assert.match(structural,/«Abstract Class»/);assert.match(structural,/\{leaf\}/);assert.match(structural,/id/)
 const meta=e('Servicio','uml-metaclass');assert.match(html('uml-profile',meta),/Servicio/)
 const stereo=e('Auditable','uml-stereotype');stereo.uml={attributes:[{id:'one',name:'nivel',type:'Integer',visibility:'public'}]};assert.match(html('uml-profile',stereo),/«stereotype»/);assert.match(html('uml-profile',stereo),/nivel/)
 for(const type of ['uml-package','uml-subpackage','uml-model','uml-profile'] as const){const named=e(type,type);const rendered=html('uml-package',named);assert.match(rendered,/uml-/);assert.doesNotMatch(rendered,/NaN|Infinity/)}
})

it('Estructura compuesta: clasificador, puerto, parte, rol y colaboración conservan cuerpos específicos',()=>{
 for(const type of ['uml-class','uml-port','uml-part','uml-reference-role','uml-collaboration'] as const){
  const n=e(type,type);const result=html('uml-composite',n);assert.ok(result.includes('kind-'+type));assert.doesNotMatch(result,/NaN|Infinity/)
 }
 const structural=e('Motor de pago','uml-class');structural.uml={attributes:[{id:'a',name:'monto',type:'Decimal',visibility:'public'}]}
 assert.match(html('uml-composite',structural),/internal structure/)
})

it('Actividades: acción local, objeto con estados y pines stream/exception conservan semántica visual',()=>{
 const action=e('Emitir reporte','uml-action');action.activityDetail={...activityDefaults('uml-action'),kind:'callBehavior',precondition:'Autorizado',postcondition:'Terminado'}
 const a=html('uml-activity',action,{activityMembership:'Contabilidad'});assert.match(a,/localPrecondition/);assert.match(a,/localPostcondition/);assert.match(a,/activity-rake/);assert.match(a,/Contabilidad/)
 const object=e('Reporte','uml-object-node');object.activityDetail={...activityDefaults('uml-object-node'),externalType:'ReportePdf',inState:['generado','firmado']}
 const o=html('uml-activity',object);assert.match(o,/ReportePdf/);assert.match(o,/\[generado\]/);assert.match(o,/\[firmado\]/)
 for(const type of ['uml-activity-pin','uml-activity-parameter'] as const){const pin=e('salida',type);const p=html('uml-activity',pin,{activityParameter:{stream:true,exception:true},activityParameterLabel:'Resultado'});assert.match(p,/Resultado/);assert.match(p,/\{stream\}/);assert.match(p,/excepción/)}
 const part=e('Ventas','uml-partition');assert.match(html('uml-activity',part),/Ventas/)
})

it('Secuencia y estados: marcos, referencias, líneas de vida y regiones no intercambian notación',()=>{
 const frame=e('Validación','uml-frame');frame.summary='[aprobado]\n[else]';frame.uml={classifier:'alt'}
 const f=html('uml-sequence',frame);assert.match(f,/uml-combined-fragment/);assert.match(f,/\[aprobado\]/);assert.match(f,/\[else\]/)
 const ref=e('Consultar identidad','uml-interaction');ref.summary='Validar servicio';assert.match(html('uml-sequence',ref),/uml-interaction-ref-title/)
 const line=e('Servicio','uml-lifeline');const l=html('uml-communication',line,{sequenceEndY:400});assert.match(l,/uml-lifeline/)
 const state=e('Revisando','uml-state');state.summary='entry: validar\ndo: preparar';assert.match(html('uml-state',state),/entry: validar/)
 const region=e('Estados externos','uml-region');region.summary='Submáquina';assert.match(html('uml-state',region),/Submáquina/)
 assert.doesNotMatch(f,/NaN|Infinity/)
})

it('Despliegue: icono de dispositivo, runtime y artefacto muestran sus variantes semánticas',()=>{
 const server=e('Nodo virtual','uml-device');server.uml={deviceIcon:'desktop'};assert.match(html('uml-deployment',server),/Nodo virtual/)
 const runtime=e('Node 22','uml-execution');runtime.uml={runtimeIcon:'nodejs'};assert.match(html('uml-deployment',runtime),/Node 22/)
 const artifact=e('reporte.jar','uml-artifact');assert.match(html('uml-deployment',artifact),/reporte.jar/)
 for(const type of ['uml-device','uml-execution','uml-artifact'] as const){const r=html('uml-deployment',e(type,type));assert.doesNotMatch(r,/NaN|Infinity/)}
})
