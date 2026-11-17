import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('docs/MANIFEST_UML_DESPLIEGUE.sha256.json',root),'utf8'))
let errors=0;for(const [file,expected] of Object.entries(manifest.files)){try{const actual=createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');if(actual!==expected)throw Error('hash diferente')}catch(e){console.error(file,e.message);errors++}}
console.log(`ATLAS UML Despliegue · ${Object.keys(manifest.files).length} archivos · ${errors?'FALLÓ':'OK'} · ${fileURLToPath(root)}`);process.exitCode=errors?1:0
