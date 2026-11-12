import {defineConfig,devices} from '@playwright/test'
const baseURL=process.env.E2E_BASE_URL||'http://127.0.0.1:5173'
const target=new URL(baseURL)
if(!['127.0.0.1','localhost'].includes(target.hostname))throw new Error('E2E solo permite localhost: no ejecutes pruebas destructivas contra producción')
export default defineConfig({
 testDir:'./tests/e2e',timeout:45_000,expect:{timeout:12_000},fullyParallel:false,workers:1,
 use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure'},
 reporter:[['list'],['html',{outputFolder:'test-results/html',open:'never'}]],
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:process.env.ATLAS_E2E_AUTOSTART==='true'?[
  {command:'npm run dev:api',url:'http://127.0.0.1:3001/api/v1/health',reuseExistingServer:false,timeout:60000},
  {command:'npm run dev:web',url:'http://127.0.0.1:5173',reuseExistingServer:false,timeout:60000}
 ]:undefined,
 outputDir:'test-results/artifacts'
})
