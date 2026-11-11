import {type Diagram, type DiagramType, type ElementType, type ModelElement, type ProjectDocument, emptyDoc} from './types'
const date='2026-11-11'
function element(id:string,name:string,type:ElementType,summary:string,technical='',group=''):ModelElement{
 return {id,name,type,summary,description:summary,owner: type==='requirement'?'Producto': 'Equipo ATLAS',author:'Equipo de demostración',status:'Validado',createdAt:'2026-11-01',updatedAt:date,group,technical,links: type==='requirement'?[{id:`link-${id}`,label:'Jira (ejemplo)',url:'https://www.atlassian.com/software/jira'}]:[],fields:{}}
}
const E:ModelElement[]=[
 element('actor','Usuario final','actor','Persona que utiliza la aplicación'),
 element('platform','Plataforma Zercano','system','Ecosistema de servicios profesionales','Plataforma digital'),
 element('payment-provider','Pasarela externa','external','Procesa cobros externos','API externa'),
 element('app-web','Aplicación web','container','Interfaz para usuarios y profesionales','React / Vue'),
 element('app-mobile','Aplicación móvil','container','Cliente móvil del producto','Flutter'),
 element('api','Backend API','container','Orquesta operaciones y expone APIs','Node.js / TypeScript'),
 element('database','Base de datos','database','Persistencia de negocio','PostgreSQL'),
 element('auth-service','Servicio de autenticación','service','Controla sesiones y permisos','AuthService · JWT','Autenticación'),
 element('payment-service','Servicio de pagos','service','Crea y confirma transacciones','PaymentService','Pagos'),
 element('notify-service','Servicio de notificaciones','service','Envía alertas de transacciones','NotificationService','Notificaciones'),
 element('auth-controller','AuthController','component','Gestiona solicitudes de autenticación','AuthController · TypeScript','Autenticación'),
 element('token-validator','TokenValidator','component','Valida tokens y permisos','validateToken()','Autenticación'),
 element('login','Inicio de sesión','activity','El usuario envía sus credenciales','POST /auth/login','Autenticación'),
 element('validate','Validar identidad','activity','Verificar credenciales y sesión','POST /auth/validate','Autenticación'),
 element('choose','Seleccionar forma de pago','activity','Selecciona un método de pago','PaymentForm · UI','Pagos'),
 element('execute','Procesar pago','activity','Se solicita el cobro a un proveedor externo','POST /payments','Pagos'),
 element('result','Mostrar resultado','activity','Se presenta el comprobante','PaymentResult · UI','Pagos'),
 element('notify','Notificar operación','activity','Envía un mensaje de confirmación','NotificationService','Notificaciones'),
 element('endpoint-auth','POST /auth/validate','endpoint','Contrato de verificación de sesión','request: token → response: valid, userId','Autenticación'),
 element('endpoint-pay','POST /payments','endpoint','Crea una transacción','request: amount, method → response: id, status','Pagos'),
 element('hu-auth','HU-001 · Acceso seguro','requirement','Como usuario quiero identificarme de forma segura','Criterios de aceptación: sesión válida','Autenticación'),
 element('hu-pay','HU-021 · Confirmar pago','requirement','Como usuario quiero pagar y obtener confirmación','Criterios de aceptación: resultado trazable','Pagos'),
 element('cu-pay','CU-004 · Realizar pago','usecase','Flujo principal y alternativas de pago','','Pagos'),
 element('tx','Entidad Transaction','database','Registro transaccional','tabla transactions','Pagos'),
 element('evt','Pago confirmado','event','Evento publicado después del cobro','payment.confirmed','Pagos')
]
function d(id:string,name:string,type:DiagramType,description:string,nodes:[string,number,number][],edges:[string,string,string?][]):Diagram{
return {id,name,type,description,createdAt:date,nodes:nodes.map(([elementId,x,y])=>({id:`n-${elementId}`,elementId,x,y})),edges:edges.map(([a,b,label],i)=>({id:`e-${id}-${i}`,source:`n-${a}`,target:`n-${b}`,label}))}
}
const diagrams:Diagram[]=[
d('c1','C1 · Contexto de Zercano','c1','Personas, plataforma y terceros',[['actor',50,180],['platform',440,160],['payment-provider',850,175]],[['actor','platform','Usa'],['platform','payment-provider','Procesa pagos']]),
d('c2','C2 · Contenedores','c2','Aplicaciones, API y persistencia',[['actor',50,160],['app-web',380,55],['app-mobile',380,270],['api',720,145],['database',1050,65],['payment-provider',1050,300]],[['actor','app-web','Utiliza'],['actor','app-mobile','Utiliza'],['app-web','api','HTTPS'],['app-mobile','api','HTTPS'],['api','database','Consulta'],['api','payment-provider','API']]),
d('c3','C3 · Componentes del backend','c3','Dependencias dentro de Backend API',[['api',45,150],['auth-service',380,30],['payment-service',380,240],['notify-service',730,240],['database',1060,200]],[['api','auth-service','Autentica'],['api','payment-service','Cobra'],['payment-service','auth-service','Autoriza'],['payment-service','notify-service','Evento'],['payment-service','database','Guarda']]),
d('c4','C4 · Autenticación','c4','Detalle de implementación',[['auth-service',35,170],['auth-controller',365,150],['token-validator',710,150],['endpoint-auth',1060,150]],[['auth-service','auth-controller','Contiene'],['auth-controller','token-validator','Valida'],['token-validator','endpoint-auth','Expone']]),
d('process','Proceso · Autenticación y pagos','process','Recorrido funcional conectado con implementación',[['login',40,175],['validate',340,175],['choose',640,175],['execute',940,175],['result',1240,70],['notify',1240,290]],[['login','validate','Sesión'],['validate','choose','Autorizado'],['choose','execute','Confirmación'],['execute','result','Respuesta'],['execute','notify','Evento']]),
d('sequence','Secuencia · Confirmar pago','sequence','Interacciones técnicas en orden',[['actor',30,180],['app-web',340,180],['endpoint-auth',650,60],['endpoint-pay',650,305],['payment-service',990,195],['payment-provider',1330,195]],[['actor','app-web','Confirmar'],['app-web','endpoint-auth','Validar'],['app-web','endpoint-pay','Enviar pago'],['endpoint-pay','payment-service','Procesar'],['payment-service','payment-provider','Cobrar']]),
d('data','Flujo de datos · Transacción','data','Movimiento y almacenamiento de información',[['app-web',50,145],['endpoint-pay',380,145],['payment-service',710,145],['tx',1040,145]],[['app-web','endpoint-pay','Datos'],['endpoint-pay','payment-service','Request'],['payment-service','tx','Persistencia']]),
d('trace','Trazabilidad · Pago','trace','Del requisito a la implementación',[['hu-pay',50,170],['cu-pay',390,170],['execute',730,170],['endpoint-pay',1070,170],['payment-service',1410,170]],[['hu-pay','cu-pay','Detalla'],['cu-pay','execute','Describe'],['execute','endpoint-pay','Invoca'],['endpoint-pay','payment-service','Implementa']]),
]
export const demoDocument = ():ProjectDocument => {
 const doc=emptyDoc(); doc.elements=Object.fromEntries(E.map(e=>[e.id,{...e,fields:{...e.fields},links:[...e.links]}])); doc.diagrams=diagrams.map(d=>({...d,nodes:d.nodes.map(n=>({...n})),edges:d.edges.map(e=>({...e}))}));
 doc.elements['platform'].childDiagramId='c2';doc.elements['api'].childDiagramId='c3';doc.elements['auth-service'].childDiagramId='c4';doc.elements['execute'].childDiagramId='sequence';doc.elements['hu-pay'].fields['f-priority']='Alta';doc.elements['endpoint-pay'].fields['f-method']='POST';return doc
}
