import {test,expect} from '@playwright/test'
import {openQaDemo,openQaDiagram,observeQaHttp} from './qa-navigation'
const email=process.env.E2E_ADMIN_EMAIL||''
const password=process.env.E2E_ADMIN_PASSWORD||''
const viewerEmail=process.env.E2E_VIEWER_EMAIL||''
const viewerPassword=process.env.E2E_VIEWER_PASSWORD||''
// Playwright uses a single QA API and all Chromium contexts share its localhost IP.
// Reuse this validated QA admin session for functional scenarios instead of consuming
// one of the six production-strength login requests for every independent test.
// Each Playwright test still gets its own browser context; no credentials are written to disk.
let adminCookies:Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>>=[]
// Do not let skipped tests create a false green build when E2E credentials are missing.
if(!email||!password)throw new Error('Configura E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD en una base LOCAL DE QA antes de test:e2e')
test.beforeEach(({context})=>observeQaHttp(context))
async function signIn(page:import('@playwright/test').Page){
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Iniciar sesión'})).toBeVisible()
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:/Entrar a NOVZI/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 adminCookies=await page.context().cookies()
}
// Run standalone tests normally when using --grep; within the full suite, the
// already verified login from the prior test is reused without another POST /auth/login.
async function enterAdminWithCachedSession(page:import('@playwright/test').Page){
 if(!adminCookies.length){await signIn(page);return}
 await page.context().addCookies(adminCookies)
 await page.goto('/')
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
}
test('acceso cerrado: no hay registro público y rechaza password incorrecto',async({page})=>{
 await page.goto('/')
 await expect(page.getByText('Acceso cerrado. No existe registro público.')).toBeVisible()
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill('incorrecta-2026!')
 await page.getByRole('button',{name:/Entrar a NOVZI/}).click()
 await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas')
})
test('login válido, C1 y navegación entre vistas ya guardadas',async({page})=>{
 await signIn(page)
 await openQaDemo(page)
 await expect(page.getByText('DIAGRAMAS', {exact:true})).toBeVisible()
 await openQaDiagram(page,'C1 · Contexto de Zercano','C1 · Contexto')
 await expect(page.getByRole('heading',{name:/C1 · Contexto/})).toBeVisible()
 await openQaDiagram(page,'C2 · Contenedores','C2 · Contenedores')
 await expect(page.getByRole('heading',{name:/C2 · Contenedores/})).toBeVisible()
})
test('crear diagrama y caja, actualizar ficha y comprobar guardado',async({page})=>{
 await enterAdminWithCachedSession(page)
 await openQaDemo(page)
 const name='QA Proceso '+Date.now()
 await page.getByRole('button',{name:'Crear diagrama'}).first().click()
 const diagramDialog=page.getByRole('dialog',{name:'Nuevo diagrama'})
 await expect(diagramDialog).toBeVisible()
 await diagramDialog.getByLabel('Nombre del diagrama').fill(name)
 await diagramDialog.getByLabel('Tipo de visualización').selectOption('custom')
 await diagramDialog.getByRole('button',{name:'Crear',exact:true}).click()
 await expect(page.getByRole('heading',{name})).toBeVisible()
 await page.getByRole('button',{name:'Agregar caja'}).first().click()
 const nodeDialog=page.getByRole('dialog',{name:'Agregar caja al diagrama'})
 await expect(nodeDialog).toBeVisible()
 await nodeDialog.getByLabel('Nombre de la caja').fill('Actividad QA')
 await nodeDialog.getByLabel('Tipo de elemento').selectOption('activity')
 await nodeDialog.getByRole('button',{name:'Agregar al lienzo'}).click()
 await expect(page.getByText('Actividad QA')).toBeVisible()
 const summary='Validación automática de edición'
 // Wait for the actual committed version containing the edited element; a
 // pre-existing "Guardado" badge can refer to an older write in flight.
 const [saved]=await Promise.all([
  page.waitForResponse(async r=>{
   if(r.request().method()!=='PUT'||!/\/api\/v1\/projects\/[^/]+\/document$/.test(new URL(r.url()).pathname)||!r.ok())return false
   const json=await r.json().catch(()=>null)
   return Object.values(json?.document?.elements||{}).some((e:unknown)=>{
    const element=e as {name?:string;summary?:string};return element.name==='Actividad QA'&&element.summary===summary
   })
  },{timeout:20000}),
  page.getByLabel('Resumen').fill(summary)
 ])
 expect(saved.ok()).toBe(true)
 await expect(page.locator('.save-chip.saved')).toBeVisible({timeout:20000})
 await page.reload()
 await openQaDemo(page)
 await openQaDiagram(page,name,'Libres')
 await expect(page.getByText('Actividad QA')).toBeVisible()
})
test('administrador abre políticas centralizadas por organización',async({page})=>{
 await enterAdminWithCachedSession(page)
 await page.getByRole('button',{name:'Usuarios y accesos de la organización'}).click()
 await expect(page.getByRole('heading',{name:'Usuarios y accesos de la organización'})).toBeVisible()
 await page.getByRole('button',{name:'Roles y permisos'}).click()
 const space=page.getByRole('combobox',{name:'Espacio de las políticas'})
 await space.click()
 await page.getByRole('listbox').getByRole('option').first().click()
 await expect(page.getByText('diagram.view.c1')).toBeVisible()
 await expect(page.getByText('relation.delete.technical')).toBeVisible()
 await expect(page.getByRole('button',{name:'Crear cuenta'})).toHaveCount(0)
})
test('lector tiene solo las vistas y operaciones autorizadas',async({page})=>{
 if(!viewerEmail||!viewerPassword)throw Error('Configura E2E_VIEWER_EMAIL y E2E_VIEWER_PASSWORD para probar denegación UI')
 await page.goto('/')
 await page.getByLabel('Correo electrónico').fill(viewerEmail)
 await page.getByLabel('Contraseña').fill(viewerPassword)
 await page.getByRole('button',{name:/Entrar a NOVZI/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 await openQaDemo(page)
 await expect(page.getByRole('button',{name:'Exportar'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Importar'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Crear diagrama'})).toHaveCount(0)
})

// A fresh project created through the real UI, populated using the supported
// JSON import. The actual React Flow canvas, pointer events, API and PostgreSQL
// participate; no fake onConnect callback or network interception.
test('UML en Chromium: mensajes laterales múltiples, persistencia y símbolos de estado',async({page})=>{
 test.setTimeout(90000)
 await page.setViewportSize({width:1600,height:1000})
 await enterAdminWithCachedSession(page)
 await openQaDemo(page)
 const name='QA UML real '+Date.now()
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click()
 const projectDialog=page.getByRole('dialog',{name:'Crear proyecto'})
 await projectDialog.getByLabel('Nombre del proyecto').fill(name)
 await projectDialog.getByRole('button',{name:'Crear',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Elige un diagrama'})).toBeVisible()
 const date='2026-11-14',elements:Record<string,unknown>={}
 function element(id:string,type:string){elements[id]={id,name:id,type,summary:'',description:'',owner:'',author:'NOVZI QA',status:'Borrador',createdAt:date,updatedAt:date,links:[],fields:{}}}
 for(const [id,type] of [['pa','uml-lifeline'],['pb','uml-lifeline'],['aa','uml-activation'],['ab','uml-activation'],['start','uml-start'],['choice','uml-decision'],['end','uml-end'],['history','uml-history-shallow'],['deep','uml-history-deep'],['entry','uml-entry-point'],['exit','uml-exit-point'],['termination','uml-terminate']])element(id,type)
 const document={schema:1,elements,fieldDefinitions:[],diagrams:[
  {id:'seq',name:'Secuencia QA real',type:'uml-sequence',description:'',createdAt:date,nodes:[
   {id:'pa',elementId:'pa',x:100,y:100,width:170,height:480},{id:'pb',elementId:'pb',x:500,y:100,width:170,height:480},
   {id:'aa',elementId:'aa',parentNodeId:'pa',x:61,y:70,width:48,height:300},{id:'ab',elementId:'ab',parentNodeId:'pb',x:61,y:70,width:48,height:300}],edges:[]},
  {id:'state',name:'Estados QA real',type:'uml-state',description:'',createdAt:date,nodes:['start','choice','end','history','deep','entry','exit','termination'].map((id,i)=>({id,elementId:id,x:100+(i%4)*170,y:100+Math.floor(i/4)*170,width:84,height:84})),edges:[{id:'transition-1',source:'start',target:'choice',sourceHandle:'right',targetHandle:'left',relationKind:'transition',label:''},{id:'transition-2',source:'choice',target:'end',sourceHandle:'right',targetHandle:'left',relationKind:'transition',label:'[ok]'}]}
 ]}
 await page.locator('input[type=file]').setInputFiles({name:'qa-uml.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))})
 await page.getByRole('dialog',{name:'Confirmar importación'}).getByRole('button',{name:'Importar documento'}).click()
 await expect(page.getByRole('heading',{name:'Secuencia QA real'})).toBeVisible()
 const a=page.locator('.react-flow__node[data-id="aa"]'),b=page.locator('.react-flow__node[data-id="ab"]')
 await expect(a.locator('.uml-sequence-activation-bar')).toBeVisible()
 await expect(b.locator('.uml-sequence-activation-bar')).toBeVisible()
 await expect(a.locator('[data-handleid^="seq-right-"]').first()).toBeAttached()
 expect(await a.locator('[data-handleid^="seq-right-"]').count()).toBeGreaterThanOrEqual(3)
 await expect(a.locator('[data-handleid^="top-"], [data-handleid^="bottom-"]')).toHaveCount(0)
 // Fit the measured diagram through the real canvas control before pointer input.
 // React Flow may mount before the import's node measurements settle.
 await page.locator('.react-flow__controls-fitview').click()
 // Pointer drag at the actual rendered location, rather than invoking a handler.
 async function connect(from:typeof a,to:typeof b,left:string,right:string,index:number){
  const source=from.locator(`[data-handleid="seq-${left}-${index}"]`),target=to.locator(`[data-handleid="seq-${right}-${index}"]`)
  await expect(source).toBeAttached();await expect(target).toBeAttached()
  await expect.poll(async()=>{
   const canvas=await page.locator('.react-flow').boundingBox(),s=await source.boundingBox(),t=await target.boundingBox(),viewport=page.viewportSize()
   if(!canvas||!s||!t||!viewport)return false
   return [s,t].every(r=>{const x=r.x+r.width/2,y=r.y+r.height/2;return x>Math.max(0,canvas.x)&&x<Math.min(viewport.width,canvas.x+canvas.width)&&y>Math.max(0,canvas.y)&&y<Math.min(viewport.height,canvas.y+canvas.height)})
  },{message:'Ambos puertos deben estar dentro del lienzo y de la ventana tras ajustar vista'}).toBe(true)
  await source.hover({force:true});const s=await source.boundingBox(),t=await target.boundingBox();expect(s).not.toBeNull();expect(t).not.toBeNull()
  await page.mouse.move(s!.x+s!.width/2,s!.y+s!.height/2);await page.mouse.down();await page.mouse.move(t!.x+t!.width/2,t!.y+t!.height/2,{steps:18});await page.mouse.up()
 }
 await connect(a,b,'right','left',1)
 await expect(page.locator('.react-flow__edge')).toHaveCount(1)
 await connect(b,a,'left','right',2)
 await expect(page.locator('.react-flow__edge')).toHaveCount(2)
 await connect(a,b,'right','left',3)
 await expect(page.locator('.react-flow__edge')).toHaveCount(3)
 await expect(page.getByText('Guardado',{exact:true})).toBeVisible({timeout:20000})
 await page.reload()
 await page.getByRole('button',{name,exact:true}).click()
 await openQaDiagram(page,'Secuencia QA real','UML · Secuencia')
 await expect(page.locator('.react-flow__edge')).toHaveCount(3)
 await openQaDiagram(page,'Estados QA real','UML · Máquina de estados')
 await expect(page.locator('.react-flow__node .novzi-uml-control')).toHaveCount(8)
 await expect(page.locator('.react-flow__node[data-id="choice"] polygon')).toHaveCount(1)
 await expect(page.locator('.react-flow__node[data-id="history"] svg text')).toHaveText('H')
 await expect(page.locator('.react-flow__node[data-id="deep"] svg text')).toHaveCount(2)
 await expect(page.locator('.react-flow__node[data-id="termination"] svg path')).toHaveCount(1)
 await expect(page.locator('.react-flow__edge')).toHaveCount(2)
})


test('UML Clases QA: parámetros legibles, scroll local y corrección de multiplicidad',async({page})=>{
 test.setTimeout(90000)
 await page.setViewportSize({width:1280,height:900});await enterAdminWithCachedSession(page);await openQaDemo(page)
 await expect(page.getByRole('button',{name:'Nuevo proyecto',exact:true})).toBeVisible()
 const name='QA Clases parámetros '+Date.now();await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click();const projectDialog=page.getByRole('dialog',{name:'Crear proyecto'});await projectDialog.getByLabel('Nombre del proyecto').fill(name);await projectDialog.getByRole('button',{name:'Crear',exact:true}).click();await expect(page.getByRole('heading',{name:'Elige un diagrama'})).toBeVisible()
 const date='2026-11-16',element={id:'pedido',name:'Pedido QA scroll',type:'uml-class',summary:'',description:'',owner:'',author:'QA',status:'Borrador',createdAt:date,updatedAt:date,links:[],fields:{},uml:{operations:[{id:'op',name:'pagar',visibility:'public',returnType:'Boolean',parameters:[{id:'p1',name:'monto',type:'Real',multiplicity:'1'},{id:'p2',name:'moneda',type:'String'}]}]}};
 const doc={schema:1,elements:{pedido:element},fieldDefinitions:[],diagrams:[{id:'class-scroll',name:'Clases QA scroll',type:'uml-class',description:'',createdAt:date,nodes:[{id:'node',elementId:'pedido',x:200,y:150,width:330,height:200}],edges:[]}]}
 await page.locator('input[type=file]').setInputFiles({name:'qa-clases-scroll.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 const [imported]=await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&/^\/api\/v1\/projects\/[^/]+\/import$/.test(new URL(r.url()).pathname)),page.getByRole('dialog',{name:'Confirmar importación'}).getByRole('button',{name:'Importar documento'}).click()]);expect(imported.ok()).toBe(true)
 const documentPath=new URL(imported.url()).pathname.replace(/\/import$/,'/document');await expect(page.getByRole('heading',{name:'Clases QA scroll'})).toBeVisible();await expect(page.locator('[data-tour="perspective"]')).toHaveCount(0);await expect(page.getByText(/Diagnóstico UML/)).toHaveCount(0)
 await page.locator('.react-flow__node[data-id="node"]').click();const region=page.getByRole('region',{name:'Campos del parámetro monto'});await expect(region).toBeVisible();await expect.poll(()=>region.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeGreaterThan(0);for(const input of await region.locator('input,select').all())expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(95);await region.evaluate(el=>el.scrollLeft=el.scrollWidth);expect(await region.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0)
 const multiplicity=page.getByLabel('Multiplicidad parámetro p1');await multiplicity.fill('1..');await expect(multiplicity).toHaveAttribute('aria-invalid','true');await expect(region.getByRole('alert')).toContainText('Multiplicidad inválida');await expect(page.locator('.save-chip')).toHaveText('Guardado');
 // Wait for the real successful document PUT, not just an already visible save chip.
 const [saved]=await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname===documentPath,{timeout:20000}),multiplicity.fill('1..*')]);expect(saved.ok(),'El servidor debe aceptar la multiplicidad corregida').toBe(true)
 const persisted=await saved.json();expect(persisted.document.elements.pedido.uml.operations[0].parameters[0].multiplicity).toBe('1..*');expect(persisted.document.elements.pedido.uml.operations[0].parameters[1].name).toBe('moneda')
 await expect(multiplicity).toHaveAttribute('aria-invalid','false');await expect(page.locator('.save-chip')).toHaveText('Guardado',{timeout:20000})
 await page.reload();await openQaDemo(page);const project=page.getByRole('button',{name,exact:true});await project.click();await expect(project).toHaveClass(/\bon\b/);await openQaDiagram(page,'Clases QA scroll','UML · Clases');await page.locator('.react-flow__node[data-id="node"]').click();await expect(page.getByLabel('Multiplicidad parámetro p1')).toHaveValue('1..*');await expect(page.getByLabel('Nombre parámetro p2')).toHaveValue('moneda')
})
