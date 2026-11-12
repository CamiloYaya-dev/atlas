import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
const root=fileURLToPath(new URL('..',import.meta.url))
const env={...process.env,
 DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
 MIGRATIONS_DATABASE_URL:'postgresql://atlas:atlas_test_only@127.0.0.1:5433/atlas_test',
 NODE_ENV:'test',AUTH_MODE:'local',ATLAS_ALLOW_DB_TESTS:'true',
 ATLAS_CSRF_SECRET:'atlas-qa-local-csrf-for-automated-tests-only-2026',
 E2E_ADMIN_EMAIL:'qa-admin@atlas.test',E2E_ADMIN_PASSWORD:randomBytes(20).toString('base64url')+'!A',
 E2E_VIEWER_EMAIL:'qa-viewer@atlas.test',E2E_VIEWER_PASSWORD:randomBytes(20).toString('base64url')+'!B',
 E2E_EDITOR_EMAIL:'qa-editor@atlas.test',E2E_EDITOR_PASSWORD:randomBytes(20).toString('base64url')+'!C',
 ATLAS_E2E_AUTOSTART:'true', E2E_BASE_URL:'http://127.0.0.1:5175',
 ATLAS_DEV_API_PORT:'3003',ATLAS_DEV_WEB_PORT:'5175'
}
function exec(label,cmd,args){
 console.log(`\n[ATLAS QA] ${label}`)
 // On Windows, never run node.exe through cmd.exe: C:\Program Files would be split by the shell.
 const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit',env,shell:process.platform==='win32' && cmd!==process.execPath})
 if(result.status!==0)process.exit(result.status||1)
}
// E2E starts its own API and frontend in a browser against the QA database only.
exec('PostgreSQL exclusivo QA (5433)','docker',['compose','--profile','test','up','-d','--wait','db_test'])
exec('Migraciones en QA','npm',['run','db:migrate'])
exec('Datos ficticios QA','npm',['run','db:seed'])
exec('Usuarios temporales QA','npm',['run','e2e:seed','-w','@atlas/api'])
exec('Navegador y recorridos reales',process.execPath,['node_modules/@playwright/test/cli.js','test'])
