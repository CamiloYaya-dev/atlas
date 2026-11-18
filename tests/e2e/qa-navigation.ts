import {expect,type Page,type BrowserContext} from '@playwright/test'

/** Log API rejections before navigation, without cookies, query parameters or bodies. */
export function observeQaHttp(context:BrowserContext){
 context.on('response',response=>{
  const status=response.status(),path=new URL(response.url()).pathname
  if(path.startsWith('/api/v1/')&&(status===429||status>=500||path==='/api/v1/workspaces'&&status>=400))
   console.error(`[NOVZI E2E HTTP] ${response.request().method()} ${path} -> ${status}`)
 })
}
/** Select the seeded project through its actual UI and avoid resetting an already selected workspace. */
export async function openQaDemo(page:Page){
 const workspace=page.getByLabel('Espacio de trabajo',{exact:true})
 const option=workspace.getByRole('option',{name:'Zercano · DEMO',exact:true})
 await expect(option,'El espacio QA debe estar presente en el catálogo autorizado').toHaveCount(1)
 const id=await option.getAttribute('value')
 if(!id)throw Error('El espacio QA no tiene identidad')
 if(await workspace.inputValue()!==id)await workspace.selectOption(id)
 await expect(workspace).toHaveValue(id)
 const project=page.getByRole('button',{name:'Zercano · Plataforma',exact:true})
 await expect(project).toBeVisible()
 if(!(await project.getAttribute('class'))?.split(/\s+/).includes('on'))await project.click()
 await expect(project).toHaveClass(/\bon\b/)
 await expect(page.locator('[data-tour="diagram-nav"]').getByRole('button',{name:/carpeta C1 · Contexto$/}),
  'El proyecto QA debe cargar su carpeta C1 antes de navegar').toBeVisible()
}

/** Open the real diagram folder before selecting its diagram. Since the sidebar
 * was grouped by visualization type, a collapsed folder does not render its
 * .diagram-item buttons. Never fall back to a generic button elsewhere on the
 * page (e.g. a linked view inside the current diagram).
 *
 * The exact diagram title and active state are part of the assertion, not merely
 * the fact that a button with a matching substring was clicked.
 */
export async function openQaDiagram(page:Page,name:string,folderLabel:string){
 const navigation=page.locator('[data-tour="diagram-nav"]')
 const expand=navigation.getByRole('button',{name:`Expandir carpeta ${folderLabel}`,exact:true})
 if(await expand.count())await expand.click()
 await expect(navigation.getByRole('button',{name:`Contraer carpeta ${folderLabel}`,exact:true}),
  `La carpeta ${folderLabel} debe quedar abierta`).toBeVisible()
 const diagram=navigation.locator('button.diagram-item').filter({has:page.getByText(name,{exact:true})})
 await expect(diagram,`Debe existir un único diagrama llamado ${name} dentro de ${folderLabel}`).toHaveCount(1)
 await expect(diagram).toBeVisible()
 await diagram.click()
 await expect(diagram).toHaveClass(/\bon\b/)
 await expect(page.getByRole('heading',{name,exact:true})).toBeVisible()
}
