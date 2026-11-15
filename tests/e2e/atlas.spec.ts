import {test,expect} from '@playwright/test'
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
async function signIn(page:import('@playwright/test').Page){
 await page.goto('/')
 await expect(page.getByRole('heading',{name:'Iniciar sesión'})).toBeVisible()
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:/Entrar a ATLAS/}).click()
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
 await page.getByRole('button',{name:/Entrar a ATLAS/}).click()
 await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas')
})
test('login válido, C1 y navegación entre vistas ya guardadas',async({page})=>{
 await signIn(page)
 await expect(page.getByText('DIAGRAMAS', {exact:true})).toBeVisible()
 await page.getByRole('button',{name:/C1 · Contexto/}).first().click()
 await expect(page.getByRole('heading',{name:/C1 · Contexto/})).toBeVisible()
 await page.getByRole('button',{name:/C2 · Contenedores/}).first().click()
 await expect(page.getByRole('heading',{name:/C2 · Contenedores/})).toBeVisible()
})
test('crear diagrama y caja, actualizar ficha y comprobar guardado',async({page})=>{
 await enterAdminWithCachedSession(page)
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
 await page.getByLabel('Resumen').fill('Validación automática de edición')
 await expect(page.getByText('Guardado', {exact:true})).toBeVisible({timeout:20000})
 await page.reload()
 await page.getByRole('button',{name}).first().click()
 await expect(page.getByRole('heading',{name})).toBeVisible()
 await expect(page.getByText('Actividad QA')).toBeVisible()
})
test('administrador abre políticas y encuentra roles y permisos por operación',async({page})=>{
 await enterAdminWithCachedSession(page)
 await page.getByRole('button',{name:'Accesos'}).click()
 await expect(page.getByRole('heading',{name:'Usuarios y políticas de acceso'})).toBeVisible()
 await expect(page.getByRole('button',{name:/Roles y comportamientos/})).toBeVisible()
 await expect(page.getByText('diagram.view.c1')).toBeVisible()
 await expect(page.getByText('relation.delete.technical')).toBeVisible()
})
test('lector tiene solo las vistas y operaciones autorizadas',async({page})=>{
 if(!viewerEmail||!viewerPassword)throw Error('Configura E2E_VIEWER_EMAIL y E2E_VIEWER_PASSWORD para probar denegación UI')
 await page.goto('/')
 await page.getByLabel('Correo electrónico').fill(viewerEmail)
 await page.getByLabel('Contraseña').fill(viewerPassword)
 await page.getByRole('button',{name:/Entrar a ATLAS/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 await expect(page.getByRole('button',{name:'Exportar'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Importar'})).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Crear diagrama'})).toHaveCount(0)
})

// A fresh project created through the real UI, populated using the supported
// JSON import. The actual React Flow canvas, pointer events, API and PostgreSQL
// participate; no fake onConnect callback or network interception.
test('UML en Chromium: mensajes laterales múltiples, persistencia y símbolos de estado',async({page})=>{
 test.setTimeout(90000)
 await enterAdminWithCachedSession(page)
 const name='QA UML real '+Date.now()
 await page.getByRole('button',{name:'Nuevo proyecto',exact:true}).click()
 const projectDialog=page.getByRole('dialog',{name:'Crear proyecto'})
 await projectDialog.getByLabel('Nombre del proyecto').fill(name)
 await projectDialog.getByRole('button',{name:'Crear',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Elige un diagrama'})).toBeVisible()
 const date='2026-11-14',elements:Record<string,unknown>={}
 function element(id:string,type:string){elements[id]={id,name:id,type,summary:'',description:'',owner:'',author:'ATLAS QA',status:'Borrador',createdAt:date,updatedAt:date,links:[],fields:{}}}
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
 // Pointer drag at the actual rendered location, rather than invoking a handler.
 async function connect(from:typeof a,to:typeof b,left:string,right:string,index:number){
  const source=from.locator(`[data-handleid="seq-${left}-${index}"]`),target=to.locator(`[data-handleid="seq-${right}-${index}"]`)
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
 await page.getByRole('button',{name:/Secuencia QA real/}).click()
 await expect(page.locator('.react-flow__edge')).toHaveCount(3)
 await page.getByRole('button',{name:/Estados QA real/}).click()
 await expect(page.locator('.react-flow__node .atlas-uml-control')).toHaveCount(8)
 await expect(page.locator('.react-flow__node[data-id="choice"] polygon')).toHaveCount(1)
 await expect(page.locator('.react-flow__node[data-id="history"] svg text')).toHaveText('H')
 await expect(page.locator('.react-flow__node[data-id="deep"] svg text')).toHaveCount(2)
 await expect(page.locator('.react-flow__node[data-id="termination"] svg path')).toHaveCount(1)
 await expect(page.locator('.react-flow__edge')).toHaveCount(2)
})
