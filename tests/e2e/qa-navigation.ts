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
 await expect(page.getByRole('button',{name:/C1 · Contexto/}).first()).toBeVisible()
}

/** The diagram button also exposes its semantic badge in the accessible name.
 * Match the visible title within the actual diagram navigation, not the whole button. */
export async function openQaDiagram(page:Page,name:string){
 const diagram=page.getByRole('button').and(page.locator('[data-tour="diagram-nav"] .diagram-item')).filter({has:page.getByText(name,{exact:true})})
 await expect(diagram,`Debe existir un único diagrama con título ${name} en el proyecto seleccionado`).toHaveCount(1)
 await expect(diagram).toBeVisible()
 await diagram.click()
 await expect(diagram).toHaveClass(/\bon\b/)
 await expect(page.getByRole('heading',{name,exact:true})).toBeVisible()
}
