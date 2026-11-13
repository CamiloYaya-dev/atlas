const fs=require('node:fs');const assert=require('node:assert/strict')
const {chromium}=require('playwright')
const css=fs.readFileSync('apps/web/src/features/academy/academy.css','utf8')
;(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
 try{
  const html=`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>*{box-sizing:border-box}body{margin:0;background:#f4f6fb;font-family:Arial,sans-serif}${css}</style></head><body><section class="academy-missions"><header class="academy-missions-header"><span>ATLAS Academy</span><button>Cerrar</button></header><div class="academy-missions-content"><div class="academy-intro"><h2>Aprende construyendo</h2><p>Contenido de práctica</p></div><div class="academy-course"><div class="academy-course-body">${'<div class="academy-check"><div><strong>Ejercicio del laboratorio</strong><p>Selecciona una caja, completa la ficha e introduce un campo personalizado.</p><div class="academy-task-actions"><button class="academy-task-btn">Abrir Inspector</button></div></div></div>'.repeat(12)}</div></div></div><footer class="academy-coach-footer"><button class="academy-direction"><span><strong>↓ Baja para continuar</strong><small>Documenta la HU</small></span></button><label class="academy-idle-setting">Recordarme el paso tras <select><option>2 minutos</option></select></label></footer></section></body></html>`
  for(const [width,height] of [[320,568],[375,812],[768,1024],[1366,768],[1920,1080]]){
   const page=await browser.newPage({viewport:{width,height}});await page.setContent(html)
   const rect=await page.evaluate(()=>{const panel=document.querySelector('.academy-missions').getBoundingClientRect(),footer=document.querySelector('.academy-coach-footer').getBoundingClientRect();return {panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},footer:{left:footer.left,top:footer.top,right:footer.right,bottom:footer.bottom}}})
   assert(rect.panel.left>=-1&&rect.panel.right<=width+1&&rect.panel.top>=-1&&rect.panel.bottom<=height+1,JSON.stringify({width,height,rect}))
   assert(rect.footer.top>=rect.panel.top&&rect.footer.bottom<=height+1,JSON.stringify({width,height,rect}))
   console.log('PASS CSS Academy panel/footer',width+'x'+height)
   await page.close()
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
