import {defineConfig,devices} from '@playwright/test'
const baseURL=process.env.E2E_BASE_URL||'http://127.0.0.1:5173'
const target=new URL(baseURL)
const batch=process.env.NOVZI_E2E_BATCH
if(batch&&!/^batch-\d+$/.test(batch))throw Error('Identificador de lote E2E inválido')
const reportRoot=batch?`test-results/e2e-batches/${batch}`:'test-results'
const devApiPort=Number(process.env.NOVZI_DEV_API_PORT||3002)
// Opción para reutilizar Chromium instalado, sin alterar la configuración de Windows.
const chromiumExecutable=process.env.NOVZI_E2E_CHROMIUM_EXECUTABLE
if(!['127.0.0.1','localhost'].includes(target.hostname))throw new Error('E2E solo permite localhost: no ejecutes pruebas destructivas contra producción')
export default defineConfig({
 testDir:'./tests/e2e',timeout:45_000,expect:{timeout:12_000},fullyParallel:false,workers:1,
 use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure'},
 reporter:[['list'],['html',{outputFolder:`${reportRoot}/html`,open:'never'}],...(batch?[['json',{outputFile:`${reportRoot}/result.json`}] as ['json',{outputFile:string}]]:[])],
 projects:[{name:'chromium',use:{...devices['Desktop Chrome'],...(chromiumExecutable?{launchOptions:{executablePath:chromiumExecutable,args:['--no-sandbox']}}:{})}}],
 webServer:process.env.NOVZI_E2E_AUTOSTART==='true'?[
  {command:'npm run dev:api',url:`http://127.0.0.1:${devApiPort}/api/v1/health`,reuseExistingServer:false,timeout:60000},
  {command:'npm run dev:web',url:baseURL,reuseExistingServer:false,timeout:60000}
 ]:undefined,
 outputDir:`${reportRoot}/artifacts`
})
