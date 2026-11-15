import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

// Las pruebas DOM/React se miden aparte del backend. Sin esta medición,
// c8 de Node mostraba 0% engañoso en casi todos los componentes React.
export default defineConfig({
 plugins:[react()],
 test:{
  environment:'jsdom',
  setupFiles:['./src/test/setup.ts'],
  include:['src/**/*.browser.test.{ts,tsx}'],
  clearMocks:true,
  // El catálogo UML y los recorridos DOM compiten por CPU/memoria bajo V8.
  // Limitar concurrencia; no reintentar ni ocultar fallos.
  maxWorkers:4,
  coverage:{
   provider:'v8',
   include:['src/**/*.{ts,tsx}'],
   exclude:['src/**/*.browser.test.{ts,tsx}','src/**/*.unit.test.{ts,tsx}','src/**/*.test.ts','src/**/*.d.ts','src/test/**','src/features/security/types.ts'],
   reporter:['text','html','lcov','json-summary','json'],
   reportsDirectory:'../../coverage/frontend',
  }
 }
})
