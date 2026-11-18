import ts from './node_modules/typescript/lib/typescript.js';
import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(s.startsWith('.')&&c.parentURL){for(const ext of ['.ts','.tsx','/index.ts','.js']){const u=new URL(s+ext,c.parentURL);if(existsSync(fileURLToPath(u)))return {url:u.href,shortCircuit:true}}}throw e}}
export async function load(url,c,n){if(/\.tsx?$/.test(url)&&url.startsWith('file:'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};return n(url,c)}
