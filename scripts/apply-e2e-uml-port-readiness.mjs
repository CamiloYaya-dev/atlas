import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const flag=process.argv.at(-1)
if(!['--check','--apply'].includes(flag)){console.error('Uso: node scripts/apply-e2e-uml-port-readiness.mjs --check|--apply');process.exit(2)}
const file=path.resolve('tests/e2e/novzi.spec.ts')
const input=fs.readFileSync(file,'utf8')
const before=`  await expect(source).toBeVisible()\n  await expect(target).toBeVisible()\n  await source.hover({force:true})`
const insert="  await expect(source).toBeVisible()\n  await expect(target).toBeVisible()\n  // Los puertos deben ser alcanzables por el mouse, no solo existir en el DOM.\n  // React Flow añade connectionindicator cuando la política permite conectar.\n  // No uses force:true: fuerza el hover incluso si el puerto está cubierto.\n  const portState=async(locator:typeof source)=>locator.evaluate(el=>{\n   const box=el.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2\n   const hit=document.elementFromPoint(x,y),style=getComputedStyle(el)\n   return {id:el.getAttribute('data-handleid'),classes:el.className,hit:hit===el||el.contains(hit),hitTag:hit?.tagName||null,hitClass:typeof hit?.className==='string'?hit.className:'',pointerEvents:style.pointerEvents,visibility:style.visibility,opacity:style.opacity,width:box.width,height:box.height,x,y}\n  })\n  try{\n   await expect.poll(async()=>{\n    const [s,t]=await Promise.all([portState(source),portState(target)])\n    return s.hit&&t.hit&&s.classes.includes('connectionindicator')&&t.classes.includes('connectionindicator')\n   },{timeout:9000,intervals:[200,400,800],message:'Puertos de activación UML interactivos con la política de relaciones cargada'}).toBe(true)\n  }catch{\n   const [s,t]=await Promise.all([portState(source),portState(target)])\n   throw new Error(`PUERTOS UML NO INTERACTIVOS: origen=${JSON.stringify(s)}, destino=${JSON.stringify(t)}. Revisar acceso relation.create, superposición CSS y React Flow; no se simuló la conexión.`)\n  }\n  await source.hover()"
const count=(input.match(/await source\.hover\(\{force:true\}\)/g)||[]).length
if(input.includes('PUERTOS UML NO INTERACTIVOS:')){console.log('[NOVZI QA] Diagnóstico ya instalado.');process.exit(0)}
if(!input.includes(before)||count!==1){console.error('[NOVZI QA] El archivo difiere de la versión esperada. No se ha reemplazado nada.');process.exit(1)}
const output=input.replace(before,insert)
if(flag==='--check'){console.log('[NOVZI QA] Compatible. Solo se reforzará el diagnóstico del arrastre UML. Sin cambios.');process.exit(0)}
const stamp=new Date().toISOString().replaceAll(':','-')
fs.copyFileSync(file,`${file}.backup-port-readiness-${stamp}`)
fs.writeFileSync(file,output)
console.log('[NOVZI QA] Prueba E2E reforzada:',file)
console.log('[NOVZI QA] SHA-256:',crypto.createHash('sha256').update(output).digest('hex'))
