/** Criterio V4: 90% real global y en cada capa API/WEB/PACKAGES.
 * El control 95% por archivo se mantiene INALTERADO en coverage-gate.mjs.
 * Nunca modifica reportes ni excluye archivos para aumentar las cifras.
 */
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
const summaryFile=resolve(root,'coverage/coverage-summary.json')
if(!existsSync(summaryFile)){console.error('Falta medición real. Ejecuta npm run test:coverage.');process.exit(1)}
const summary=JSON.parse(readFileSync(summaryFile,'utf8'))
const files=Object.entries(summary).filter(([p])=>p!=='total')
if(files.length<1)throw Error('No hay archivos instrumentados')
const METRICS=['lines','statements','functions','branches']
let failures=0
const norm=p=>p.replaceAll('\\','/')
const measured=new Set(files.map(([p])=>norm(p)))
// El porcentaje alto no autoriza aprobar un proyecto con código omitido.
function visit(directory,relative){
 if(!existsSync(directory))return
 for(const e of readdirSync(directory,{withFileTypes:true})){
  const sub=resolve(directory,e.name),p=`${relative}/${e.name}`
  if(e.isDirectory()){visit(sub,p);continue}
  if(p.startsWith('apps/web/src/test/')||p==='apps/web/src/features/security/types.ts')continue
  if(!/\.(ts|tsx)$/.test(e.name)||/\.d\.ts$|\.(unit\.|integration\.|browser\.)?test\.ts(x)?$/.test(e.name))continue
  if(![...measured].some(file=>file===p||file.endsWith('/'+p))){console.error('ARCHIVO SIN MEDIR:',p);failures++}
 }
}
for(const area of ['apps/api/src','apps/web/src','packages/contracts/src','packages/fixtures/src'])visit(resolve(root,area),area)
function check(group,items){
 if(!items.length){console.error(`${group}: no hay archivos medidos`);failures++;return}
 for(const m of METRICS){
  const covered=items.reduce((a,[,stat])=>a+(stat[m]?.covered||0),0)
  const total=items.reduce((a,[,stat])=>a+(stat[m]?.total||0),0)
  const pct=total?100*covered/total:100
  const ok=total>0&&pct>=90
  console.log(`${group.padEnd(9)} ${m.padEnd(11)} ${pct.toFixed(2).padStart(7)}% ${ok?'OK':'FALTA'} (${covered}/${total})`)
  if(!ok)failures++
 }
}
console.log('ATLAS | HITO 90%: cobertura real global y por capa, cuatro métricas.')
check('TOTAL',files)
check('API',files.filter(([p])=>norm(p).includes('apps/api/src/')))
check('WEB',files.filter(([p])=>norm(p).includes('apps/web/src/')))
check('PACKAGES',files.filter(([p])=>norm(p).includes('packages/')))
if(failures){console.error(`El mínimo de aceptación V4 no se cumple: ${failures} controles pendientes. Se mantiene la puerta 95% por archivo.`);process.exit(1)}
console.log('HITO 90% CUMPLIDO: proyecto completo medido y métricas ≥90%. Todavía ejecuta pruebas E2E/DB y el control final 95%.')
