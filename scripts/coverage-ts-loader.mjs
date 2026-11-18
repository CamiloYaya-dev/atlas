/** QA-only ESM transpilation. Every process uses the same source representation. */
import ts from 'typescript'
import {readFileSync,statSync} from 'node:fs'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {resolve as pathResolve,relative,isAbsolute,sep} from 'node:path'
const root=fileURLToPath(new URL('../',import.meta.url))
const projectFile=url=>{if(!url?.startsWith('file:'))return false;const p=relative(root,fileURLToPath(url));return !isAbsolute(p)&&(p.startsWith('apps'+sep)||p.startsWith('packages'+sep))&&!p.includes(`${sep}node_modules${sep}`)}
const isFile=p=>{try{return statSync(p).isFile()}catch{return false}}
export async function resolve(specifier,context,nextResolve){
 try{return await nextResolve(specifier,context)}catch(error){
  if(error.code!=='ERR_MODULE_NOT_FOUND'&&error.code!=='ERR_UNSUPPORTED_DIR_IMPORT')throw error
  if(!context.parentURL||!specifier.startsWith('.')||!projectFile(context.parentURL))throw error
  const base=fileURLToPath(new URL(specifier,context.parentURL))
  for(const candidate of [base+'.ts',base+'.tsx',pathResolve(base,'index.ts'),pathResolve(base,'index.tsx')])if(isFile(candidate))return {url:pathToFileURL(candidate).href,shortCircuit:true}
  throw error
 }
}
export async function load(url,context,nextLoad){
 if(!projectFile(url)||!(/\.tsx?$/.test(new URL(url).pathname)))return nextLoad(url,context)
 const file=fileURLToPath(url)
 const {outputText}=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,inlineSourceMap:true,inlineSources:true,esModuleInterop:true}})
 return {format:'module',source:outputText,shortCircuit:true}
}
