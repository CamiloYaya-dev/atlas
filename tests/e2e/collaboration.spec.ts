import {test,expect} from '@playwright/test'
import {openQaDemo,openQaDiagram,observeQaHttp} from './qa-navigation'
const adminEmail=process.env.E2E_ADMIN_EMAIL||'',adminPassword=process.env.E2E_ADMIN_PASSWORD||''
const editorEmail=process.env.E2E_EDITOR_EMAIL||'',editorPassword=process.env.E2E_EDITOR_PASSWORD||''
if(!adminEmail||!adminPassword||!editorEmail||!editorPassword)throw Error('E2E requires two independent QA accounts')
async function enter(page:import('@playwright/test').Page,email:string,password:string){
 await page.goto('/')
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:/Entrar a NOVZI/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 await openQaDemo(page)
}
test('dos usuarios diferentes: cambios independientes sobreviven y el rol limitado no ve C3',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext()
 observeQaHttp(a);observeQaHttp(b)
 try{
  const pageA=await a.newPage(),pageB=await b.newPage()
  await enter(pageA,adminEmail,adminPassword)
  await enter(pageB,editorEmail,editorPassword)
  await expect(pageB.locator('[data-tour="diagram-nav"] .diagram-folder-toggle').filter({hasText:'C3 · Componentes'}),'El rol limitado no debe recibir ni la carpeta C3').toHaveCount(0)
  // Different identities, one workspace. SSE delivers authorized updates without a reload.
  await expect(pageA.locator('.collab-status')).toContainText('en línea',{timeout:20000})
  await expect(pageB.locator('.collab-status')).toContainText('en línea',{timeout:20000})
  await openQaDiagram(pageA,'C1 · Contexto de Zercano','C1 · Contexto')
  const contentA='Edición A '+Date.now()
  const [savedA]=await Promise.all([
   pageA.waitForResponse(r=>r.request().method()==='PUT'&&/\/api\/v1\/projects\/[^/]+\/document$/.test(new URL(r.url()).pathname),{timeout:20000}),
   pageA.getByLabel('Descripción').fill(contentA)
  ])
  expect(savedA.ok(),'La escritura de A debe persistir en PostgreSQL').toBe(true)
  expect((await savedA.json()).document.diagrams.find((d:{id:string})=>d.id==='c1')?.description).toBe(contentA)
  await expect(pageA.locator('.save-chip.saved')).toBeVisible({timeout:20000})
  await openQaDiagram(pageB,'C1 · Contexto de Zercano','C1 · Contexto')
  await expect(pageB.getByLabel('Descripción')).toHaveValue(contentA,{timeout:20000})
  await openQaDiagram(pageB,'C2 · Contenedores','C2 · Contenedores')
  const contentB='Edición B '+Date.now()
  const [savedB]=await Promise.all([
   pageB.waitForResponse(r=>r.request().method()==='PUT'&&/\/api\/v1\/projects\/[^/]+\/document$/.test(new URL(r.url()).pathname),{timeout:20000}),
   pageB.getByLabel('Descripción').fill(contentB)
  ])
  expect(savedB.ok(),'La escritura de B debe persistir en PostgreSQL').toBe(true)
  const persistedB=(await savedB.json()).document.diagrams as Array<{id:string;description:string}>
  expect(persistedB.find(d=>d.id==='c1')?.description,'La escritura de B no debe pisar C1').toBe(contentA)
  expect(persistedB.find(d=>d.id==='c2')?.description,'B solo modifica C2').toBe(contentB)
  await expect(pageB.locator('.save-chip.saved')).toBeVisible({timeout:20000})
  await openQaDiagram(pageA,'C2 · Contenedores','C2 · Contenedores')
  await expect(pageA.getByLabel('Descripción')).toHaveValue(contentB,{timeout:20000})
  // Persisted read in a fresh browser load complements the live assertions.
  await pageA.reload()
  await pageB.reload()
  await openQaDemo(pageA)
  await openQaDemo(pageB)
  await openQaDiagram(pageA,'C1 · Contexto de Zercano','C1 · Contexto')
  await openQaDiagram(pageB,'C2 · Contenedores','C2 · Contenedores')
  await expect(pageA.getByLabel('Descripción')).toHaveValue(contentA)
  await expect(pageB.getByLabel('Descripción')).toHaveValue(contentB)
 }finally{await a.close();await b.close()}
})
