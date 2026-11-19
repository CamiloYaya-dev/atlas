/** TAP summary reader for individual Node --test processes. No global state. */
const summaryKey=/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/
const status=/^(\s*)not ok\s+\d+\s+-\s+(.+?)\s*$/
const field=(line,key)=>line.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`))?.[1]?.replace(/^['"]|['"]$/g,'')
function scalarError(lines,index,indent){
 const raw=field(lines[index],'error')||''
 if(!/^\|[-+]?$/u.test(raw))return raw
 const content=[]
 for(let k=index+1;k<lines.length;k++){
  const line=lines[k],space=line.match(/^\s*/)?.[0].length??0
  if(line.trim()&&space<=indent)break
  if(line.trim())content.push(line.trim())
 }
 // Node --test may provide a multiline assertion with a precise actual/expected delta.
 const diff=content.find(x=>/\s!==\s/.test(x))
 const head=content.find(x=>x&&!/^(?:\d+\s*!==\s*\d+)$/.test(x))
 return [head,diff].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' ').slice(0,500)||'Error de aserción (consulta integration.log)'
}
export function parseTap(source,exitCode=0){
 const lines=source.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/)
 const firstError=lines.find(line=>/^(?:#\s*)?(?:Error(?: \[[^\]]+\])?:|\w*Error:|Cannot find module|ERR_MODULE_NOT_FOUND)/.test(line.trim()))?.replace(/^\s*#\s*/, '').trim()||''
 const counts={tests:0,pass:0,fail:0,cancelled:0,skipped:0,todo:0}
 let hasCounts=false
 const rawFailures=[]
 for(let i=0;i<lines.length;i++){
  const line=lines[i]
  const count=line.match(summaryKey)
  if(count){counts[count[1]]=Number(count[2]);if(count[1]==='tests')hasCounts=true}
  const match=line.match(status)
  if(!match)continue
  const indent=match[1].length
  const failure={name:match[2],location:'',message:'',indent}
  // Leer solo el bloque YAML del fallo, nunca salida ajena de otras pruebas.
  let yaml=false
  for(let j=i+1;j<Math.min(lines.length,i+100);j++){
   const current=lines[j]
   if(/^\s*---\s*$/.test(current)){yaml=true;continue}
   if(yaml&&/^\s*\.\.\.\s*$/.test(current))break
   if(!yaml&&(/^\s*(?:not ok|ok)\s+\d+\s+-/.test(current)||current.startsWith('1..')))break
   if(!yaml)continue
   failure.location ||= field(current,'location')||''
   if(!failure.message&&/^\s*error:\s*/.test(current))failure.message=scalarError(lines,j,current.match(/^\s*/)?.[0].length??0)
  }
  if((failure.message==='test failed'||failure.message==='ERR_TEST_FAILURE')&&firstError)failure.message=firstError
  rawFailures.push(failure)
 }
 // Node test informa dos fallos para una aserción anidada:
 // el caso real y su grupo padre (error: '1 subtest failed').
 // Mantener los totales TAP intactos pero listar solo errores accionables.
 const failures=rawFailures.filter(f=>!( /^(?:\d+\s+)?subtests? failed$/i.test(f.message)
  &&rawFailures.some(child=>child.indent>f.indent)))
  .map(({indent,...failure})=>failure)
 if(!hasCounts&&exitCode!==0){counts.tests=1;counts.fail=1;failures.push({name:'No se pudo ejecutar el archivo de pruebas',location:'',message:firstError||'Consulta el registro completo'})}
 else if(exitCode!==0&&counts.fail===0){counts.fail=1;counts.tests=Math.max(counts.tests,counts.pass+1);failures.push({name:'El ejecutor terminó con error',location:'',message:firstError||'Consulta el registro completo'})}
 return {...counts,failures,exitCode}
}
