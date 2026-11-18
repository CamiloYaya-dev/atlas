import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {atlasNodeSize,createElement,emptyDoc} from './index'
import type {Diagram,DiagramNode,ProjectDocument} from './index'
import {deploymentCube,deploymentPort,deploymentFacingPort,deploymentGlyph,deploymentSvgScene} from './uml-deployment-geometry'
import {activityFrameBounds,activityDisplayPosition,activityParameterLabel,activityMembershipLabel,activityPorts,activityPort,activitySymbol,activityExceptionRoute,activitySvgScene} from './uml-activity-geometry'
import {sequenceSnapChild,sequencePositionLocked} from './uml-sequence-layout'
import {useCaseExtensionNote,useCaseRelationKinds,useCaseSubjects,validUseCaseDetail,validUseCaseEdgeShape,useCaseElementIsReferenced} from './uml-usecase-policy'
import {umlAbsolutePosition} from './uml-containers'
const fixture=(name:string):ProjectDocument=>JSON.parse(readFileSync(new URL(`../../../qa/ATLAS_QA_UML_${name}.json`,import.meta.url),'utf8'))

test('Deployment: recursos de tipo e instancia conservan anclajes definidos por el contorno visible',()=>{
 const d=fixture('DESPLIEGUE'),r={x:20,y:40,width:200,height:100}
 assert.equal(deploymentCube(d,d.elements.host),true);assert.equal(deploymentCube(d,d.elements['host-instance']),true);assert.equal(deploymentCube(d,d.elements['api-instance']),false)
 for(const [handle,expected] of [['left',{x:21,y:90,side:'left'}],['right',{x:219,y:90,side:'right'}],['top-2',{x:120,y:41,side:'top'}],['bottom-2',{x:120,y:139,side:'bottom'}]] as const)assert.deepEqual(deploymentPort(r,true,handle,true),expected)
 assert.deepEqual(deploymentPort(r,false,'right',true),{x:220,y:90,side:'right'})
 assert.deepEqual(deploymentFacingPort(r,true,{x:120,y:0}),{x:120,y:41,side:'top'});assert.deepEqual(deploymentFacingPort(r,true,{x:600,y:90}),{x:219,y:90,side:'right'})
})
test('Deployment: glifos distinguen tipo, instancia, parte y DeploymentSpecification; el SVG no ejecuta texto',()=>{
 const d=fixture('DESPLIEGUE'),size={width:420,height:380}
 assert.match(deploymentGlyph(d,d.elements.host,size,true),/«device»/);assert.match(deploymentGlyph(d,d.elements.runtime,size,true),/«executionEnvironment»/)
 const i=deploymentGlyph(d,d.elements['host-instance'],size,false);assert.match(i,/text-decoration="underline"/);assert.match(i,/cores = 4/)
 assert.match(deploymentGlyph(d,d.elements.role,size,false),/\[2\]/);const spec=deploymentGlyph(d,d.elements.spec,size,false);assert.match(spec,/«deployment spec»/);assert.match(spec,/deploymentLocation = \/srv\/app/)
 assert.doesNotMatch(deploymentGlyph(d,d.elements.spec,size,true),/deploymentLocation =/)
 d.elements.host.name='<script>alert(1)</script>';const scene=deploymentSvgScene(d,d.diagrams[0]);assert.ok(scene.width>0&&scene.height>0);assert.match(scene.markup,/&lt;script&gt;/);assert.doesNotMatch(scene.markup,/<script>/);assert.doesNotMatch(scene.markup,/NaN|Infinity/);assert.match(scene.markup,/«deploy»/)
})
test('Activity: los símbolos de control y los pines tienen anclas distintas; puertos históricos no mueven la ficha',()=>{
 const d=fixture('ACTIVIDADES'),r={x:100,y:200,width:84,height:84}
 assert.equal(activityPorts(d.elements.lane).length,0);assert.equal(activityPorts(d.elements.region).length,0)
 for(const id of ['start','end','flow-end','decision']){assert.equal(activityPorts(d.elements[id]).length,4);assert.deepEqual(activityPort(r,d.elements[id],'top-1',true),activityPort(r,d.elements[id],'top-2',true))}
 const fork=d.elements.fork;const horizontal=activityPorts({...fork,activityDetail:{...fork.activityDetail,orientation:'horizontal'}}),vertical=activityPorts({...fork,activityDetail:{...fork.activityDetail,orientation:'vertical'}});assert.equal(horizontal.filter(p=>p.side==='top').length,3);assert.equal(vertical.filter(p=>p.side==='right').length,3)
 assert.equal(activityPorts(d.elements.outpin).length,4);assert.equal(activityPorts(d.elements.validate).length,8);assert.deepEqual(activityPort(r,d.elements.lane,'left',false),{x:100,y:242,side:'left'})
})
test('Activity: parámetros se fijan a lados opuestos de la actividad y el pin al borde de su acción',()=>{
 const d=fixture('ACTIVIDADES'),v=d.diagrams[0],frame=activityFrameBounds(d,v)!,input=v.nodes.find(n=>n.id==='param-in')!,output=v.nodes.find(n=>n.id==='param-out')!,pin=v.nodes.find(n=>n.id==='outpin')!,owner=v.nodes.find(n=>n.id==='prepare')!
 const a=activityDisplayPosition(d,v,input,frame),b=activityDisplayPosition(d,v,output,frame)
 assert.equal(a.x+atlasNodeSize(v.type,d.elements[input.elementId],input).width/2,frame.x);assert.equal(b.x+atlasNodeSize(v.type,d.elements[output.elementId],output).width/2,frame.x+frame.width)
 const p=activityDisplayPosition(d,v,pin,frame);assert.equal(p.x+atlasNodeSize(v.type,d.elements[pin.elementId],pin).width/2,umlAbsolutePosition(v,owner).x+atlasNodeSize(v.type,d.elements[owner.elementId],owner).width)
 const parameter=v.activity!.parameters!.find(p=>p.id==='param-order')!;assert.ok(activityParameterLabel(d,v,d.elements['param-in']).startsWith(parameter.name));assert.equal(activityParameterLabel(d,v,d.elements.validate),d.elements.validate.name)
 assert.equal(activityMembershipLabel(d,{...d.elements.validate,activityDetail:{...d.elements.validate.activityDetail,partitionIds:['lane','missing']}}),d.elements.lane.name)
})
test('Activity: ruta de excepción tiene segmentos perpendiculares, no se confunde con interrupción y el SVG preserva símbolos',()=>{
 const d=fixture('ACTIVIDADES'),v=d.diagrams[0]
 const a=activityExceptionRoute({x:0,y:0,side:'right'},{x:100,y:100,side:'top'});assert.match(a.path,/^M 0 0 L 16 0/);assert.match(a.path,/L 100 84 L 100 100$/)
 const b=activityExceptionRoute({x:20,y:20,side:'bottom'},{x:20,y:52,side:'top'});assert.doesNotMatch(b.path,/NaN|Infinity/)
 assert.notEqual(activitySymbol(d.elements.notify),activitySymbol(d.elements.wait));assert.notEqual(activitySymbol(d.elements.wait),activitySymbol(d.elements.timeout));assert.equal(activitySymbol(d.elements.validate),undefined)
 d.elements.validate.name='<script>';const s=activitySvgScene(d,v);assert.match(s.markup,/data-activity-exception="true"/);assert.match(s.markup,/data-activity-interrupt="true"/);assert.match(s.markup,/&lt;script&gt;/);assert.doesNotMatch(s.markup,/<script>|NaN|Infinity/)
})
test('Sequence: acoples históricos respetan centro, altura mínima y límites de la barra',()=>{
 const parent={width:100,height:300},child={width:20,height:70};assert.deepEqual(sequenceSnapChild('uml-lifeline','uml-activation',parent,child,-500),{x:40,y:55});assert.deepEqual(sequenceSnapChild('actor','uml-activation',parent,child,500),{x:40,y:221});assert.deepEqual(sequenceSnapChild('uml-activation','uml-destruction',parent,{width:20,height:20},-1),{x:40,y:290})
 assert.throws(()=>sequenceSnapChild('uml-lifeline','uml-action',parent,child,0),/acople/);assert.throws(()=>sequenceSnapChild('uml-lifeline','uml-activation',parent,child,NaN),/inválida/);assert.throws(()=>sequenceSnapChild('uml-activation','uml-activation',parent,child,0),/participante/);assert.throws(()=>sequenceSnapChild('uml-lifeline','uml-activation',{width:100,height:90},child,0),/corta/)
})
test('Sequence: bloqueo temporal distingue borrador, descendiente temporizado y vista no-secuencia',()=>{
 const doc=emptyDoc();doc.elements.p={...createElement('Línea','uml-lifeline'),id:'p'};doc.elements.a={...createElement('Activación','uml-activation'),id:'a'};doc.elements.x={...createElement('Fin','uml-destruction'),id:'x'};doc.elements.g={...createElement('Gate','uml-gate'),id:'g'}
 const n=(id:string,parentNodeId?:string):DiagramNode=>({id,elementId:id,x:0,y:0,parentNodeId});const a=n('a','p'),x=n('x','a'),g=n('g');const v:Diagram={id:'v',name:'Secuencia',description:'',type:'uml-sequence',createdAt:'2026-11-16',nodes:[n('p'),a,x,g],edges:[],interaction:{id:'i',occurrences:[]}};doc.diagrams=[v]
 assert.equal(sequencePositionLocked(doc,v,a),false);assert.equal(sequencePositionLocked(doc,v,g),true);assert.equal(sequencePositionLocked(doc,v,v.nodes[0]),false)
 v.interaction!.occurrences.push({id:'t',nodeId:'x',time:30,kind:'event'});assert.equal(sequencePositionLocked(doc,v,a),true);v.interaction!.occurrences=[];doc.elements.x.sequenceDetail={occurrenceId:'t'};assert.equal(sequencePositionLocked(doc,v,a),true);assert.equal(sequencePositionLocked(doc,{...v,interaction:undefined},a),false);assert.equal(sequencePositionLocked(doc,{...v,type:'custom'},a),false)
})
test('Use case: notas de extensión muestran nombres reales, condición y estado incompleto sin inventar puntos',()=>{
 const d=fixture('CASOS_DE_USO'),v=d.diagrams[0],e=v.edges.find(e=>e.id==='r4')!;const notes=useCaseExtensionNote(d,v,e);assert.equal(notes.length,2);assert.match(notes[0],/Cupón válido/);assert.match(notes[1],/Antes del pago, Confirmación/);assert.deepEqual(useCaseExtensionNote(d,v,{...e,showExtensionNote:false}),[]);assert.deepEqual(useCaseExtensionNote(d,v,{...e,relationKind:'include'}),[]);assert.match(useCaseExtensionNote(d,v,{...e,extensionPointIds:['missing']})[1],/Punto no disponible/);assert.match(useCaseExtensionNote(d,v,{...e,extensionPointIds:[]})[1],/incompleto/)
})
test('Use case: límites tipados del contrato y relación según sujeto y clasificador final',()=>{
 const d=fixture('CASOS_DE_USO');assert.deepEqual([...useCaseSubjects(d,d.elements.book)],['s']);assert.ok(!useCaseRelationKinds(d,d.elements.book,d.elements.coupon).includes('association'));assert.ok(useCaseRelationKinds(d,d.elements.book,d.elements.external).includes('association'));assert.deepEqual(useCaseRelationKinds(d,d.elements.book,d.elements.book),[])
 const leaf={...d.elements.a,useCaseDetail:{...d.elements.a.useCaseDetail,leaf:true}};assert.ok(!useCaseRelationKinds(d,d.elements.ap,leaf).includes('generalization'))
 assert.ok(validUseCaseDetail({presentation:'rectangle',abstract:false,objective:'Objetivo',extensionPoints:[{id:'p',name:'Punto',location:'Paso 1'}]}));for(const bad of [null,[],{leaf:'true'},{presentation:'other'},{classifierId:' '},{subjectIds:['a','a']},{extensionPoints:[{id:'p',name:'P',unknown:true}]},{extensionPoints:[{id:'p',name:'P',description:12}]},{unrecognized:true},{objective:12}])assert.equal(validUseCaseDetail(bad),false,JSON.stringify(bad))
 assert.equal(validUseCaseEdgeShape({extensionPointIds:['x'],showExtensionNote:false,dependencyContext:'ref'}),true);assert.equal(validUseCaseEdgeShape({extensionPointIds:['x','x']}),false);assert.equal(validUseCaseEdgeShape({showExtensionNote:'false'}),false)
 assert.equal(useCaseElementIsReferenced(d,'book'),true);assert.equal(useCaseElementIsReferenced(d,'missing'),false)
})
