import {test,expect} from '@playwright/test'
const email=process.env.E2E_ADMIN_EMAIL||''
const password=process.env.E2E_ADMIN_PASSWORD||''
if(!email||!password)throw Error('Configura credenciales E2E de la base LOCAL QA')

async function authenticate(page:import('@playwright/test').Page){
 await page.goto('/')
 await page.getByLabel('Correo electrónico').fill(email)
 await page.getByLabel('Contraseña').fill(password)
 await page.getByRole('button',{name:/Entrar a ATLAS/}).click()
 await expect(page.getByText('API · PostgreSQL · Acceso cerrado')).toBeVisible()
 await expect(page.locator('.collab-status.connected')).toBeVisible({timeout:15000})
}

test('dos navegadores sincronizan un diagrama nuevo, las cajas y el historial sin recargar',async({browser})=>{
 const one=await browser.newContext()
 let two:import('@playwright/test').BrowserContext|null=null
 try{
  const alice=await one.newPage()
  await authenticate(alice)
  two=await browser.newContext({storageState:await one.storageState()})
  const bob=await two.newPage()
  await bob.goto('/')
  await expect(bob.locator('.collab-status.connected')).toBeVisible({timeout:15000})
  await expect(alice.locator('.collab-status')).toContainText('2 en línea',{timeout:15000})
  const diagramName='Colaboración QA '+Date.now()
  await alice.getByRole('button',{name:'Crear diagrama'}).click()
  const modal=alice.getByRole('dialog',{name:'Nuevo diagrama'})
  await modal.getByLabel('Nombre del diagrama').fill(diagramName)
  await modal.getByLabel('Tipo de visualización').selectOption('custom')
  await modal.getByRole('button',{name:'Crear',exact:true}).click()
  await expect(alice.getByText('Guardado',{exact:true})).toBeVisible({timeout:15000})
  await expect(bob.getByRole('button',{name:diagramName})).toBeVisible({timeout:15000})
  await bob.getByRole('button',{name:diagramName}).click()
  await expect(bob.getByRole('heading',{name:diagramName})).toBeVisible()
  const elementName='Elemento colaborativo '+Date.now()
  await alice.getByRole('button',{name:'Agregar caja'}).click()
  const nodeModal=alice.getByRole('dialog',{name:'Agregar caja al diagrama'})
  await nodeModal.getByLabel('Nombre de la caja').fill(elementName)
  await nodeModal.getByLabel('Tipo de elemento').selectOption('activity')
  await nodeModal.getByRole('button',{name:'Agregar al lienzo'}).click()
  await expect(alice.getByText('Guardado',{exact:true})).toBeVisible({timeout:15000})
  await expect(bob.getByText(elementName)).toBeVisible({timeout:15000})
  await alice.getByRole('button',{name:/Historial/}).click()
  await expect(alice.getByRole('dialog',{name:'Historial de versiones'})).toBeVisible()
 }finally{await one.close();if(two)await two.close()}
})
