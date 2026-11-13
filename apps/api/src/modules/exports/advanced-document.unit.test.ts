import test from 'node:test'
import assert from 'node:assert/strict'
import {inflateRawSync} from 'node:zlib'
import {availableExportFields,validateAdvancedExport,exportFieldsFor} from '@atlas/contracts'
import type {ProjectDocument} from '@atlas/contracts'
import {buildDiagramDictionary,zipFiles} from './advanced-document'
const document:ProjectDocument={schema:1,fieldDefinitions:[{id:'channel',label:'Canal',forType:'actor',kind:'text'}],elements:{a:{id:'a',name:'Usuario <final>',type:'actor',summary:'Solicitud & pago',description:'',owner:'Camilo',author:'ATLAS',status:'Activo',createdAt:'2026-11-13',updatedAt:'2026-11-13',links:[],fields:{channel:'Web'}},b:{id:'b',name:'Plataforma',type:'system',summary:'',description:'',owner:'',author:'',status:'',createdAt:'',updatedAt:'',links:[],fields:{}}},diagrams:[{id:'c1',name:'C1 test',description:'Contexto',type:'c1',createdAt:'2026-11-13',nodes:[{id:'na',elementId:'a',x:0,y:0},{id:'nb',elementId:'b',x:230,y:0}],edges:[{id:'r1',source:'na',target:'nb',label:'Usa',direction:'forward'}]}]}
const diagram=document.diagrams[0]
test('campos exportables incluyen relaciones e inspector personalizado del documento persistido',()=>{
 const fields=availableExportFields(document,diagram,'a')
 assert.equal(fields.find(f=>f.key==='custom:channel')?.value,'Web')
 assert.match(fields.find(f=>f.key==='@relations')?.value||'',/Usuario <final> → Plataforma \(Usa\)/)
})
test('selección avanzada por caja envía solo lo elegido al destino solicitado',()=>{
 const req=validateAdvancedExport(document,diagram,{mode:'both',fields:{na:{summary:'embed','custom:channel':'dictionary',owner:'omit'}}})
 assert.deepEqual(exportFieldsFor(document,diagram,document.elements.a,'na',req,'embed').map(f=>f.key),['summary'])
 assert.deepEqual(exportFieldsFor(document,diagram,document.elements.a,'na',req,'dictionary').map(f=>f.value),['Web'])
})
test('rechaza caja inexistente, campo ajeno, destino desconocido y modo incompatible',()=>{
 for(const fields of [{missing:{summary:'embed'}},{na:{unknown:'dictionary'}},{na:{summary:'bad'}},{na:{summary:'dictionary'}}]){
  assert.throws(()=>validateAdvancedExport(document,diagram,{mode:'embedded',fields}))
 }
})
test('diccionario no ejecuta HTML de campos y presenta las fichas elegidas',()=>{
 const req=validateAdvancedExport(document,diagram,{mode:'dictionary',fields:{na:{summary:'dictionary','custom:channel':'dictionary','@relations':'dictionary'}}})
 const html=buildDiagramDictionary(document,diagram,req,'export-qa')
 assert.match(html,/Usuario &lt;final&gt;/)
 assert.match(html,/Solicitud &amp; pago/)
 assert.match(html,/Canal/)
 assert.match(html,/Usuario &lt;final&gt; → Plataforma/)
 assert.doesNotMatch(html,/Usuario <final>/)
})
test('el ZIP contiene dos entradas íntegras (imagen y HTML) sin librerías extra',()=>{
 const image=Buffer.from('imagen\n'),dictionary=Buffer.from('<h1>Ejemplo</h1>')
 const zip=zipFiles([{name:'ATLAS_Diagrama.png',bytes:image},{name:'ATLAS_Diccionario.html',bytes:dictionary}])
 const entries=readLocalEntries(zip)
 assert.equal(entries.length,2)
 assert.deepEqual(entries.map(entry=>entry.name),['ATLAS_Diagrama.png','ATLAS_Diccionario.html'])
 assert.deepEqual(entries.map(entry=>entry.method),[0,8])
 assert.deepEqual(entries[0].body,image)
 assert.deepEqual(entries[1].body,dictionary)
 const centralDirectoryOffset=entries[entries.length-1].end
 assert.equal(zip.readUInt32LE(centralDirectoryOffset),0x02014b50)
 // Firma del directorio final, número de archivos y ubicación del directorio central.
 const end=zip.length-22
 assert.equal(zip.readUInt32LE(end),0x06054b50)
 assert.equal(zip.readUInt16LE(end+10),2)
 assert.equal(zip.readUInt32LE(end+16),centralDirectoryOffset)
})

function readLocalEntries(zip:Buffer){
 const entries:{name:string;method:number;body:Buffer;end:number}[]=[]
 let offset=0
 while(offset+30<=zip.length&&zip.readUInt32LE(offset)===0x04034b50){
  const method=zip.readUInt16LE(offset+8)
  const compressedSize=zip.readUInt32LE(offset+18)
  const uncompressedSize=zip.readUInt32LE(offset+22)
  const filenameLength=zip.readUInt16LE(offset+26)
  const extraLength=zip.readUInt16LE(offset+28)
  const filenameStart=offset+30,bodyStart=filenameStart+filenameLength+extraLength
  const end=bodyStart+compressedSize
  assert.ok(end<=zip.length,'La entrada ZIP no debe exceder la longitud del archivo')
  const name=zip.subarray(filenameStart,filenameStart+filenameLength).toString('utf8')
  const bytes=zip.subarray(bodyStart,end)
  assert.ok(method===0||method===8,'Método ZIP no esperado')
  const body=method===8?inflateRawSync(bytes):bytes
  assert.equal(body.length,uncompressedSize)
  entries.push({name,method,body,end})
  offset=end
 }
 return entries
}
