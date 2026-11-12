import {test,expect} from '@playwright/test'
const adminEmail=process.env.E2E_ADMIN_EMAIL||'',adminPassword=process.env.E2E_ADMIN_PASSWORD||''
const editorEmail=process.env.E2E_EDITOR_EMAIL||'',editorPassword=process.env.E2E_EDITOR_PASSWORD||''
if(!adminEmail||!adminPassword||!editorEmail||!editorPassword)throw Error('E2E requires two independent QA accounts')
async function enter(page:import('@playwright/test').Page,email:string,password:string){
 await page.goto('/')
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:/Entrar a ATLAS/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 await expect(page.getByRole('button',{name:/C1 · Contexto/}).first()).toBeVisible()
}
test('dos usuarios diferentes: cambios independientes sobreviven y el rol limitado no ve C3',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext()
 try{
  const pageA=await a.newPage(),pageB=await b.newPage()
  await enter(pageA,adminEmail,adminPassword)
  await enter(pageB,editorEmail,editorPassword)
  await expect(pageB.getByRole('button',{name:/C3 · Componentes/})).toHaveCount(0)
  // Different identities, one workspace. SSE delivers authorized updates without a reload.
  await expect(pageA.locator('.collab-status')).toContainText('en línea',{timeout:20000})
  await expect(pageB.locator('.collab-status')).toContainText('en línea',{timeout:20000})
  await pageA.getByRole('button',{name:/C1 · Contexto/}).first().click()
  const contentA='Edición A '+Date.now()
  await pageA.getByLabel('Descripción').fill(contentA)
  await expect(pageA.getByText('Guardado',{exact:true})).toBeVisible({timeout:20000})
  await pageB.getByRole('button',{name:/C1 · Contexto/}).first().click()
  await expect(pageB.getByLabel('Descripción')).toHaveValue(contentA,{timeout:20000})
  await pageB.getByRole('button',{name:/C2 · Contenedores/}).first().click()
  const contentB='Edición B '+Date.now()
  await pageB.getByLabel('Descripción').fill(contentB)
  await expect(pageB.getByText('Guardado',{exact:true})).toBeVisible({timeout:20000})
  await pageA.getByRole('button',{name:/C2 · Contenedores/}).first().click()
  await expect(pageA.getByLabel('Descripción')).toHaveValue(contentB,{timeout:20000})
  // Persisted read in a fresh browser load complements the live assertions.
  await pageA.reload()
  await pageB.reload()
  await pageA.getByRole('button',{name:/C1 · Contexto/}).first().click()
  await pageB.getByRole('button',{name:/C2 · Contenedores/}).first().click()
  await expect(pageA.getByLabel('Descripción')).toHaveValue(contentA)
  await expect(pageB.getByLabel('Descripción')).toHaveValue(contentB)
 }finally{await a.close();await b.close()}
})
