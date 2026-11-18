// Playwright shares a single API rate-limit bucket per IP. Bound each independent
// batch by source location, and restart the real webServer between batches.
// Discover from Playwright itself, so new tests are not silently omitted.
export function planE2eBatches(report,{maxLocations=3}={}){
 if(!Number.isSafeInteger(maxLocations)||maxLocations<1)throw Error('Límite de lote inválido')
 if(!report||!Array.isArray(report.suites)||report.errors?.length)throw Error('No se pudo enumerar Playwright')
 const locations=new Map(),identities=new Set()
 function visit(suite){
  for(const spec of suite.specs||[]){
   const file=spec.file?.replaceAll('\\','/')
   if(!file||!/^[\w./-]+\.spec\.[cm]?[jt]sx?$/.test(file)||file.startsWith('/')||file.split('/').includes('..')||!Number.isSafeInteger(spec.line)||spec.line<1||!spec.id||!Array.isArray(spec.tests)||!spec.tests.length)throw Error('Descriptor E2E inválido')
   const key=`${file}:${spec.line}`
   const entry=locations.get(key)||{selector:key,file,ids:[],isolated:false}
   for(const t of spec.tests){const id=`${spec.id}:${t.projectId}`;if(identities.has(id)||t.expectedStatus!=='passed')throw Error(`Prueba duplicada, omitida o con fallo esperado: ${spec.title}`);identities.add(id);entry.ids.push(id)}
   entry.isolated ||= /UML en Chromium|UML Clases QA|dos usuarios diferentes/.test(spec.title)
   locations.set(key,entry)
  }
  for(const child of suite.suites||[])visit(child)
 }
 for(const s of report.suites)visit(s)
 if(!identities.size)throw Error('Playwright no enumeró pruebas')
 const batches=[];let pending=[]
 const flush=()=>{if(pending.length){batches.push({name:`batch-${String(batches.length+1).padStart(2,'0')}`,selectors:pending.map(x=>x.selector),ids:pending.flatMap(x=>x.ids)});pending=[]}}
 for(const entry of locations.values()){
  if(entry.isolated||pending.length>=maxLocations||pending[0]?.file!==entry.file)flush()
  pending.push(entry)
  if(entry.isolated)flush()
 }
 flush();return batches
}
export function assertBatchSelection(batch,report){
 const actual=planE2eBatches(report).flatMap(b=>b.ids).sort(),expected=[...batch.ids].sort()
 if(actual.length!==expected.length||actual.some((id,i)=>id!==expected[i]))throw Error(`Selección E2E incompleta o duplicada: ${batch.name}`)
}

export function assertBatchRun(batch,report){
 assertBatchSelection(batch,report)
 const s=report.stats
 if(!s||s.expected!==batch.ids.length||s.skipped!==0||s.unexpected!==0||s.flaky!==0)throw Error(`Ejecución E2E incompleta o no aprobada: ${batch.name}`)
}

// Explicit diagnostic mode; the default still enumerates and runs ALL batches.
export function selectE2eBatches(batches,flags=[]){
 const list=flags.filter(f=>f==='--list')
 const selected=flags.filter(f=>/^--batch=batch-\d{2,}$/.test(f))
 if(list.length>1||selected.length>1||list.length+selected.length!==flags.length)throw Error('Uso: npm run test:e2e:local [-- --list | --batch=batch-04]')
 if(!selected.length)return {batches,list:!!list.length,partial:false}
 const name=selected[0].slice('--batch='.length),batch=batches.find(b=>b.name===name)
 if(!batch)throw Error(`Lote E2E inexistente: ${name}`)
 return {batches:[batch],list:!!list.length,partial:true}
}
