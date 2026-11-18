import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyDoc,createElement,availableExportFields,validateAdvancedExport,exportFieldsFor,canonicalUmlEdge,validUmlEdgeNotation,umlDisplayLabel,umlEdgeLabel,umlRelationNameLocked,umlRelationNotation,validUmlDetail,umlAttributeText,umlOperationTextResolved,umlObjectTitle} from './index'
import type {Diagram,DiagramEdge,ProjectDocument,UmlOperation} from './index'

const make=()=>{
 const d=emptyDoc();const e=createElement('Servicio de pagos','uml-class');e.id='service';e.summary='Reporte';e.links=[{label:'Jira',url:'https://example.com/issue'}];d.elements.service=e
 const client=createElement('Cliente','uml-class');client.id='client';d.elements.client=client
 const dia:Diagram={id:'d',name:'Clases de pagos',type:'uml-class',description:'',createdAt:'2026-11-16',nodes:[{id:'a',elementId:'service',x:0,y:0},{id:'b',elementId:'client',x:300,y:0}],edges:[]};d.diagrams=[dia]
 return {d,v:dia}
}
const edge=(relationKind:string,more:Partial<DiagramEdge>={}):DiagramEdge=>({id:'r',source:'a',target:'b',relationKind,...more})

test('Notación UML: relación prohibida conserva historial y la corrección canónica preserva identidad y descripción',()=>{
 const r=edge('generalization',{label:'Texto legado',description:'Descripción previa',direction:'reverse',lineStyle:'dotted'})
 assert.equal(validUmlEdgeNotation('uml-class',r),false)
 const corrected=canonicalUmlEdge('uml-class',r)
 assert.equal(corrected.id,'r');assert.equal(corrected.label,undefined);assert.equal(corrected.description,'Descripción previa\nTexto legado')
 assert.equal(corrected.direction,'forward');assert.equal(corrected.lineStyle,'solid');assert.equal(validUmlEdgeNotation('uml-class',corrected),true)
 assert.equal(canonicalUmlEdge('c4',r),r);assert.deepEqual(canonicalUmlEdge('uml-class',edge('not-supported')),edge('not-supported'))
})

test('Notación UML: cardinalidad de etiqueta, palabras reservadas y tipos heredados',()=>{
 const r=edge('deployment',{label:'Manual'})
 assert.equal(umlEdgeLabel('uml-deployment',r),'«deploy»')
 assert.equal(umlEdgeLabel('uml-class',edge('generalization',{label:'Manual'})),'')
 assert.equal(umlEdgeLabel('c3',edge('dependency',{label:'Manual'})),'Manual')
 assert.equal(umlRelationNotation('no-existe').stroke,'solid')
 assert.equal(umlRelationNameLocked('uml-sequence','create'),false)
 assert.equal(umlRelationNameLocked('uml-component','provided-interface'),true)
 assert.equal(umlRelationNameLocked('uml-class','annotation'),true)
 assert.equal(umlRelationNameLocked('c4','dependency'),false)
 assert.equal(validUmlEdgeNotation('c1',edge('no-existe')),true)
 assert.equal(validUmlEdgeNotation('uml-usecase',edge('no-existe')),false)
})

test('Notación UML: etiquetas importadas y asociaciones vinculadas se derivan del catálogo y del vínculo',()=>{
 const {d,v}=make();const alias=edge('elementImport',{importAlias:'Pago'});assert.match(umlDisplayLabel('uml-class',alias,d,v),/alias: Pago/)
 const tpl=edge('bind',{templateBindings:[{parameterId:'T',elementId:'client'}]});d.elements.client.uml={templateParameters:[{id:'T',name:'Tipo'}]};assert.match(umlDisplayLabel('uml-class',tpl,d,v),/Tipo|\?/) 
 const absent=edge('bind',{templateBindings:[{parameterId:'missing',elementId:'missing'}]});assert.match(umlDisplayLabel('uml-class',absent,d,v),/Tipo no disponible/)
 const noBinding=edge('bind');assert.equal(umlDisplayLabel('uml-class',noBinding,d,v),umlEdgeLabel('uml-class',noBinding))
 assert.equal(umlDisplayLabel('c3',edge('dependency',{label:'canal'}),d,v),'canal')
})

test('Detalles UML: funciones, atributos, títulos de objetos y tipos resueltos',()=>{
 const att={id:'a',name:'total',type:'Decimal',typeId:'decimal',visibility:'private' as const,derived:true,readOnly:true,ordered:true,unique:true,multiplicity:'0..*',length:12,defaultValue:'0'}
 assert.match(umlAttributeText(att,false,{decimal:'Dinero'}),/\/total: Dinero\(12\) \[0\.\.\*\] = 0/)
 assert.doesNotMatch(umlAttributeText(att,true,{decimal:'Dinero'}),/\(12\)/)
 const op:UmlOperation={id:'op',name:'calcular',visibility:'protected',returnType:'Decimal',returnTypeId:'decimal',query:true,parameters:[{id:'p',name:'valor',type:'Decimal',typeId:'decimal',direction:'inout',multiplicity:'1..*',defaultValue:'1'}]}
 assert.match(umlOperationTextResolved(op,{decimal:'Dinero'}),/inout valor: Dinero \[1\.\.\*\] = 1\): Dinero \{query\}/)
 assert.equal(umlObjectTitle('pago: TipoAnterior','Factura'),'pago: Factura')
 assert.equal(umlObjectTitle('pago'), 'pago')
})

test('Detalles UML: rechaza formas adversariales sin perder atributos y operaciones válidos',()=>{
 const val={attributes:[{id:'a',name:'total',type:'Decimal',visibility:'public',length:1,readOnly:false,unique:false}],operations:[{id:'o',name:'pagar',returnType:'void',visibility:'public',parameters:[{id:'p',name:'monto',type:'Decimal',direction:'inout'}]}],templateParameters:[{id:'t',name:'T',constraint:'Comparable'}],slots:[{id:'s',name:'x',value:'4'}],deviceIcon:'server',runtimeIcon:'docker'}
 assert.equal(validUmlDetail(val),true)
 for(const bad of [null,[],1,'string',{attributes:[{...val.attributes[0],length:0}]},{attributes:[{...val.attributes[0],ordered:'yes'}]},{operations:[{...val.operations[0],parameters:[{...val.operations[0].parameters[0],direction:'sideways'}]}]},{operations:[{...val.operations[0],abstract:'yes'}]},{templateParameters:[{id:'a',name:'T',constraint:12}]},{literals:[{id:'a',name:''}]},{slots:[{id:'a',name:'x',value:7}]},{slots:[{id:'a',name:'x',value:'valid',type:3}]},{note:'x'.repeat(10001)},{leaf:'yes'},{runtimeIcon:'ruby'},{classifier:22}])assert.equal(validUmlDetail(bad),false,JSON.stringify(bad).slice(0,120))
 assert.equal(validUmlDetail(undefined),true)
})

test('Exportación avanzada: ficha autorizada, vínculo granular, direcciones y campos personalizados',()=>{
 const {d,v}=make(),e=d.elements.service
 e.fields={rating:4,isActive:true,notes:['A','B']}
 d.fieldDefinitions=[{id:'rating',label:'Calificación',type:'number',forType:'all'},{id:'isActive',label:'Activo',type:'boolean',forType:'uml-class'},{id:'notes',label:'Notas',type:'text',forType:'all'}]
 d.diagrams.push({id:'sub',name:'Detalle',type:'c4',description:'',createdAt:'2026-11-16',nodes:[{id:'target',elementId:'client',x:0,y:0}],edges:[]})
 e.childDiagramId='sub';e.childNodeId='target';v.edges=[edge('dependency',{direction:'both',label:'Llama'})]
 const f=availableExportFields(d,v,'service');const field=(k:string)=>f.find(x=>x.key===k)?.value
 assert.match(field('@linked')||'',/Detalle → Cliente/);assert.match(field('@relations')||'',/Servicio de pagos ↔ Cliente/)
 assert.equal(field('custom:rating'),'4');assert.equal(field('custom:isActive'),'Sí');assert.equal(field('custom:notes'),'A, B');assert.match(field('@links')||'',/Jira/)
 const selection={a:{summary:'embed' as const,'custom:rating':'dictionary' as const}}
 const validated=validateAdvancedExport(d,v,{mode:'both',fields:selection,documentFormat:'pdf'})
 assert.equal(validated.documentFormat,'pdf')
 assert.deepEqual(exportFieldsFor(d,v,e,'a',validated,'embed').map(x=>x.key),['summary'])
 assert.deepEqual(exportFieldsFor(d,v,e,'a',validated,'dictionary').map(x=>x.key),['custom:rating'])
 assert.deepEqual(availableExportFields(d,v,'missing'),[])
 assert.deepEqual(availableExportFields(d,v,'client').filter(x=>x.key==='@linked').map(x=>x.value),[''])
})

test('Exportación avanzada: no permite cajas ocultas, campos ajenos ni destinos o formatos manipulados',()=>{
 const {d,v}=make()
 for(const [bad,text] of [[null,/Configuración/],[[],/Configuración/],[{mode:'invalid',fields:{}},/Modalidad/],[{mode:'both',fields:[]},/Selección/],[{mode:'both',fields:{missing:{summary:'embed'}}},/Caja ajena/],[{mode:'both',fields:{a:{missing:'embed'}}},/Campo o destino/],[{mode:'both',fields:{a:{summary:'unknown'}}},/Campo o destino/],[{mode:'simple',fields:{a:{summary:'embed'}}},/Modo/],[{mode:'simple',fields:{a:{summary:'dictionary'}}},/Modo/],[{mode:'both',fields:{},documentFormat:'exe'},/Formato/]] as const)assert.throws(()=>validateAdvancedExport(d,v,bad),text)
 const request=validateAdvancedExport(d,v,{mode:'simple',fields:{}})
 assert.deepEqual(exportFieldsFor(d,v,d.elements.service,'a',request,'embed'),[])
})

test('Exportación de clases: atributos tipados, firmas, longitudes, plantillas, herencia y paquetes no pierden información',()=>{
 const {d,v}=make(),e=d.elements.service
 e.uml={attributes:[{id:'a',name:'valor',type:'Dinero',typeId:'client',visibility:'public',length:11,derived:true}],operations:[{id:'o',name:'crear',visibility:'public',returnType:'Dinero',returnTypeId:'client',parameters:[{id:'p',name:'input',type:'Dinero',typeId:'client'}]}],templateParameters:[{id:'T',name:'T',typeId:'client',constraint:'Comparable'}]}
 e.semanticOwnerId='client'
 d.elements.pkg={...createElement('Pagos','uml-package'),id:'pkg'};v.nodes.push({id:'c',elementId:'pkg',x:0,y:0});v.nodes[0].parentNodeId='c'
 const f=availableExportFields(d,v,'service')
 assert.match(f.find(x=>x.key==='uml.attributes')?.value||'',/Cliente/)
 assert.match(f.find(x=>x.key==='uml.operations')?.value||'',/crear/)
 assert.match(f.find(x=>x.key==='uml.attributeLengths')?.value||'',/valor: 11/)
 assert.match(f.find(x=>x.key==='uml.templateParameters')?.value||'',/T/)
 assert.equal(f.find(x=>x.key==='uml.semanticOwner')?.value,'Cliente')
 assert.equal(f.find(x=>x.key==='uml.package')?.value,'Pagos')
})

test('Exportación de clasificadores: literales, slots, notas y valores nulos no inventan campos técnicos',()=>{
 const {d,v}=make();const object={...createElement('factura: Orden','uml-object'),id:'obj',uml:{classifier:'Orden',slots:[{id:'slot',name:'total',value:'120',type:'Dinero'}]}}
 const en={...createElement('Estado','uml-enumeration'),id:'enum',uml:{literals:[{id:'ok',name:'Pagado'}]}}
 const note={...createElement('Detalle','uml-comment'),id:'note',uml:{note:'<descripción>'}}
 d.elements.obj=object;d.elements.enum=en;d.elements.note=note
 v.nodes.push({id:'o',elementId:'obj',x:700,y:0},{id:'enum',elementId:'enum',x:900,y:0},{id:'note',elementId:'note',x:1200,y:0})
 assert.match(availableExportFields(d,v,'enum').find(x=>x.key==='uml.literals')?.value||'',/Pagado/)
 assert.equal(availableExportFields(d,v,'note').find(x=>x.key==='uml.note')?.value,'<descripción>')
 const other={...v,type:'custom' as const}
 const objfields=availableExportFields(d,other,'obj');assert.equal(objfields.find(x=>x.key==='uml.classifier')?.value,'factura: Orden')
 assert.equal(objfields.find(x=>x.key==='uml.slots')?.value,'total: Dinero = 120')
 d.elements.obj.fields={some:null};d.fieldDefinitions=[{id:'some',label:'Opcional',type:'text',forType:'all'}]
 assert.equal(availableExportFields(d,other,'obj').find(x=>x.key==='custom:some')?.value,'')
})

test('Exportación: campos por elemento se validan en ausencia de destino y en bordes máximos',()=>{
 const {d,v}=make();const e=d.elements.service
 assert.equal(availableExportFields(d,v,'client').find(x=>x.key==='@relations')?.value,'')
 d.diagrams.push({id:'sub',name:'Vacía',type:'c4',description:'',createdAt:'2026-11-16',nodes:[],edges:[]});e.childDiagramId='sub';e.childNodeId='invisible'
 assert.equal(availableExportFields(d,v,'service').find(x=>x.key==='@linked')?.value,'Vacía')
 for(const direction of ['forward','reverse','none'] as const){v.edges=[edge('dependency',{direction,label:'Pagar'})];assert.ok((availableExportFields(d,v,'service').find(x=>x.key==='@relations')?.value||'').includes(direction==='reverse'?'←':direction==='none'?'—':'→'))}
 assert.throws(()=>validateAdvancedExport(d,v,{mode:'both',fields:{a:{},b:{},c:{}}}),/Demasiadas cajas/)
 assert.throws(()=>validateAdvancedExport(d,v,{mode:'both',fields:{a:Object.fromEntries(Array.from({length:120},(_,i)=>['extra'+i,'embed']))}}),/Demasiados campos/)
 assert.deepEqual(validateAdvancedExport(d,v,{mode:'simple',fields:{a:{summary:'omit'}}}),{mode:'simple',fields:{a:{summary:'omit'}}})
})

test('Estructura UML: todos los límites de tamaño y tipos se validan sin excepciones',()=>{
 const attr={id:'id',name:'valor',type:'Number',visibility:'public'}
 const op={id:'op',name:'calcular',returnType:'void',visibility:'public',parameters:[]}
 for(const bad of [{attributes:Array(101).fill(attr)},{attributes:[{...attr,id:''}]},{attributes:[{...attr,visibility:'internal'}]},{attributes:[{...attr,type:42}]},{attributes:[{...attr,defaultValue:'x'.repeat(501)}]},{attributes:[{...attr,length:1.5}]},{operations:Array(101).fill(op)},{operations:[{...op,name:''}]},{operations:[{...op,parameters:Array(31).fill({id:'p',name:'x',type:'void'})}]},{operations:[{...op,parameters:[{id:'p',name:'',type:'void'}]}]},{operations:[{...op,returnTypeId:9}]},{literals:Array(101).fill({id:'a',name:'valor'})},{templateParameters:[{id:'T',name:'Tipo',typeId:123}]},{slots:Array(101).fill({id:'s',name:'valor',value:'0'})},{slots:[{id:'s',name:'valor',value:'x'.repeat(1001)}]},{visibility:'internal'},{deviceIcon:'satellite'},{expression:'x'.repeat(10001)}]){
  assert.equal(validUmlDetail(bad),false,Object.keys(bad)[0])
 }
 assert.equal(validUmlDetail({attributes:[{...attr,length:1000000}],operations:[{...op,parameters:[{id:'p',name:'x',type:'void',direction:'return'}]}],abstract:false,leaf:true,visibility:'package',deviceIcon:'mobile',runtimeIcon:'database'}),true)
})

test('Notación UML: etiquetas de componente provisto/requerido y dependencias de acceso conservan el tipo semántico',()=>{
 const {d,v}=make();v.type='uml-component';d.elements.client.type='uml-interface'
 const provided=edge('provided-interface');assert.equal(umlDisplayLabel('uml-component',provided,d,v),'Cliente')
 const required=edge('required-interface');assert.equal(umlDisplayLabel('uml-component',required,d,v),'Cliente')
 const label=edge('elementImport',{importAlias:'Pago'});assert.match(umlDisplayLabel('uml-component',label,d,v),/alias: Pago/)
 assert.equal(umlRelationNameLocked('uml-component','wiring'),true)
 assert.equal(umlRelationNameLocked('uml-component','assembly'),false)
 assert.equal(validUmlEdgeNotation('uml-component',edge('elementImport',{lineStyle:'dashed',direction:'forward'})),true)
 assert.equal(validUmlEdgeNotation('uml-component',edge('elementImport',{lineStyle:'solid',direction:'forward'})),false)
})

test('Etiquetas UML: el registro compartido manda en la vista de componentes y el despliegue no pierde la relación',()=>{
 const component=JSON.parse(readFileSync(new URL('../../../qa/ATLAS_QA_UML_COMPONENTES.json',import.meta.url),'utf8')) as ProjectDocument
 const v=component.diagrams[0]
 for(const id of ['wire','provided','required','eaccess','pimport']){
  const e=v.edges.find(x=>x.id===id)!
  const label=umlDisplayLabel(v.type,e,component,v)
  assert.equal(typeof label,'string',id);assert.ok(label.length>0,id)
 }
 const wire=v.edges.find(x=>x.id==='wire')!,label=umlDisplayLabel(v.type,wire,component,v)
 assert.match(label,/IPago|interface|Interfaz/i)
 const eaccess=v.edges.find(x=>x.id==='eaccess')!;component.componentRelations![eaccess.componentRelationId!].importAlias='PagoAlias'
 assert.match(umlDisplayLabel(v.type,eaccess,component,v),/PagoAlias/)
 const p=JSON.parse(readFileSync(new URL('../../../qa/ATLAS_QA_UML_DESPLIEGUE.json',import.meta.url),'utf8')) as ProjectDocument
 const dep=p.diagrams[0],de=dep.edges.find(x=>x.id==='d1-api')!
 assert.equal(typeof umlDisplayLabel(dep.type,de,p,dep),'string')
})
