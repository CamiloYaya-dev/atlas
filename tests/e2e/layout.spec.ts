import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {expect,test} from '@playwright/test'

// Prueba del CSS REAL en Chromium. jsdom no implementa la distribución CSS Grid,
// así que las pruebas de React por sí solas no detectan una columna de ancho 0.
const css=readFileSync(resolve(process.cwd(),'apps/web/src/styles.css'),'utf8')

async function mountLayout(page:import('@playwright/test').Page){
 await page.setContent(`
  <div class="layout">
   <aside class="sidebar">ATLAS · navegación</aside>
   <main class="main">
    <header class="topbar"><button id="nav-toggle" aria-label="Ocultar menú lateral">Menú</button></header>
    <section class="page-intro"><div class="heading"><h1>C1 · Contexto</h1><p>Personas y terceros</p></div></section>
    <div class="filters-bar"><button>Mixta</button><button>Filtros</button></div>
    <section class="workspace-view"><section class="canvas-frame"><div class="canvas-actions" aria-label="Acciones del diagrama"><button class="icon-btn" aria-label="Restaurar distribución">Restaurar</button><button class="primary canvas-add-node">Agregar caja</button><button class="icon-btn" aria-label="Pantalla completa del diagrama">Completa</button></div>Diagrama de prueba</section></section>
   </main>
  </div>`)
 await page.addStyleTag({content:css})
}

for(const width of [1440,1024]){
 test(`el lienzo sigue visible al ocultar el menú o ampliar el área (${width}px)`,async({page})=>{
  await page.setViewportSize({width,height:900})
  await mountLayout(page)
  const main=page.locator('.layout > .main')
  const sidebar=page.locator('.layout > .sidebar')
  await expect(main).toBeVisible()
  expect((await main.boundingBox())!.width).toBeGreaterThan(width/2)
  await page.locator('.layout').evaluate(el=>el.classList.add('expanded'))
  await expect(sidebar).toBeHidden()
  expect((await main.boundingBox())!.width).toBeGreaterThan(width*.9)
  await page.locator('.layout').evaluate(el=>el.classList.remove('expanded'))
  await expect(sidebar).toBeVisible()
  expect((await main.boundingBox())!.width).toBeGreaterThan(width/2)
 })
}

test('en móvil conserva el menú como panel deslizable',async({page})=>{
 await page.setViewportSize({width:760,height:900})
 await mountLayout(page)
 await page.locator('.layout').evaluate(el=>el.classList.add('expanded'))
 const sidebar=page.locator('.sidebar')
 await expect.poll(()=>sidebar.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(1)
 await sidebar.evaluate(el=>el.classList.add('open'))
 await expect.poll(()=>sidebar.evaluate(el=>el.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0)
 expect((await page.locator('.main').boundingBox())!.width).toBeGreaterThan(700)
})


test('expandir oculta la cabecera y filtros sin ocultar las acciones del lienzo',async({page})=>{
 await page.setViewportSize({width:1440,height:900})
 await mountLayout(page)
 const intro=page.locator('.page-intro')
 const filters=page.locator('.filters-bar')
 const actions=page.locator('.canvas-actions')
 await expect(intro).toBeVisible()
 await expect(filters).toBeVisible()
 await page.locator('.layout').evaluate(el=>el.classList.add('expanded','workspace-expanded'))
 await expect(intro).toBeHidden()
 await expect(filters).toBeHidden()
 await expect(actions.getByRole('button',{name:'Restaurar distribución'})).toBeVisible()
 await expect(actions.getByRole('button',{name:'Agregar caja'})).toBeVisible()
 await expect(actions.getByRole('button',{name:'Pantalla completa del diagrama'})).toBeVisible()
 const main=await page.locator('.main').boundingBox()
 const canvas=await page.locator('.canvas-frame').boundingBox()
 expect(canvas!.height).toBeGreaterThan(700)
 expect(main!.width).toBeGreaterThan(1300)
 await page.locator('.layout').evaluate(el=>el.classList.remove('expanded','workspace-expanded'))
 await expect(intro).toBeVisible()
 await expect(filters).toBeVisible()
})


test('ocultar solo el menú lateral conserva el título y la barra de filtros',async({page})=>{
 await page.setViewportSize({width:1440,height:900})
 await mountLayout(page)
 await page.locator('.layout').evaluate(el=>el.classList.add('expanded'))
 await expect(page.locator('.sidebar')).toBeHidden()
 await expect(page.locator('.page-intro')).toBeVisible()
 await expect(page.locator('.filters-bar')).toBeVisible()
 await expect(page.locator('.canvas-actions').getByRole('button',{name:'Agregar caja'})).toBeVisible()
})
