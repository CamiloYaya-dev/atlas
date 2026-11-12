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
