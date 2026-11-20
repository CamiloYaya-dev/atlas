import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const relative='tests/e2e/novzi.spec.ts'
const target=path.resolve(process.cwd(),relative)
const mode=process.argv.includes('--apply')?'apply':process.argv.includes('--check')?'check':null
if(!mode){console.error('Uso: node scripts/apply-e2e-uml-drag.mjs --check | --apply');process.exit(2)}
if(!fs.existsSync(target)){console.error(`No existe ${relative}. Ejecuta desde la raíz NOVZI.`);process.exit(2)}
const old=`  await source.hover({force:true});const s=await source.boundingBox(),t=await target.boundingBox();expect(s).not.toBeNull();expect(t).not.toBeNull()
  await page.mouse.move(s!.x+s!.width/2,s!.y+s!.height/2);await page.mouse.down();await page.mouse.move(t!.x+t!.width/2,t!.y+t!.height/2,{steps:18});await page.mouse.up()`
const replacement=`  // P0: no conservar coordenadas calculadas antes del inicio de la conexión.
  // React Flow puede recalcular nodos y transformar el viewport durante el drag.
  await expect(source).toBeVisible()
  await expect(target).toBeVisible()
  await source.hover({force:true})
  const s=await source.boundingBox()
  expect(s,'El puerto de origen debe tener un rectángulo medible').not.toBeNull()
  const sx=s!.x+s!.width/2,sy=s!.y+s!.height/2
  await page.mouse.move(sx,sy)
  await page.mouse.down()
  // Primer avance breve: permite a React Flow superar el umbral de arrastre.
  const initialTarget=await target.boundingBox()
  expect(initialTarget,'El puerto destino debe tener un rectángulo medible').not.toBeNull()
  const initialX=initialTarget!.x+initialTarget!.width/2
  const initialY=initialTarget!.y+initialTarget!.height/2
  await page.mouse.move(sx+(initialX-sx)*0.15,sy+(initialY-sy)*0.15,{steps:4})
  await page.mouse.move(sx+(initialX-sx)*0.6,sy+(initialY-sy)*0.6,{steps:8})
  // IMPORTANTE: las medidas del destino se obtienen otra vez EN PLENO arrastre.
  const currentTarget=await target.boundingBox()
  expect(currentTarget).not.toBeNull()
  const tx=currentTarget!.x+currentTarget!.width/2
  const ty=currentTarget!.y+currentTarget!.height/2
  await page.mouse.move(tx,ty,{steps:10})
  const targetHit=await target.evaluate(el=>{
   const r=el.getBoundingClientRect()
   const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)
   return {matches:hit===el||el.contains(hit),tag:hit?.tagName||'none',className:typeof hit?.className==='string'?hit.className:''}
  })
  const connectionPreview=await page.locator('.react-flow__connection, .react-flow__connectionline').count()
  await page.mouse.up()
  // Nunca crear artificialmente la arista para obtener un resultado verde.
  // Si falla, informar si el destino estaba cubierto, si se abrió un diálogo,
  // y si React Flow llegó a mostrar un conector temporal.
  try{
   await expect(page.locator('.react-flow__edge')).toHaveCount(index,{timeout:4500})
  }catch{
   const dialogs=await page.getByRole('dialog').allTextContents().catch(()=>[])
   const chips=await page.locator('.save-chip, [role="alert"]').allTextContents().catch(()=>[])
   const count=await page.locator('.react-flow__edge').count()
   throw new Error(No se creó la relación UML {index}: aristas={count}, preview={connectionPreview}, puertoDestino={JSON.stringify(targetHit)}, dialogos={JSON.stringify(dialogs.map(v=>v.slice(0,180)))}, avisos={JSON.stringify(chips.map(v=>v.slice(0,180)))}. No se alteró el modelo ni se simuló onConnect.)
  }`.replaceAll('\x1f','`').replaceAll('\x01','$')
const input=fs.readFileSync(target,'utf8')
if(input.includes('No se creó la relación UML ${index}: aristas=')){
 console.log(`[NOVZI QA] Aplicador ya ejecutado. Sin cambios: ${relative}`);process.exit(0)
}
const count=input.split(old).length-1
if(count!==1){console.error(`[NOVZI QA] Se esperaba una coincidencia exacta del arrastre histórico, encontradas=${count}. No se modifica ningún archivo.`);process.exit(1)}
if(mode==='check'){
 console.log(`[NOVZI QA] Compatible. Se modificará exclusivamente el arrastre de UML en ${relative}. Sin cambios.`);process.exit(0)
}
const backup=`${target}.backup-e2e-uml-${new Date().toISOString().replace(/[:.]/g,'-')}`
fs.copyFileSync(target,backup)
fs.writeFileSync(target,input.replace(old,replacement),'utf8')
const sha=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
console.log(`[NOVZI QA] Corregida interacción de prueba: ${relative}`)
console.log(`[NOVZI QA] Respaldo: ${backup}`)
console.log(`[NOVZI QA] SHA-256: ${sha}`)
