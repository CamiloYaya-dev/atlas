import { defineConfig,loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * El host externo de un piloto ngrok se habilita explícitamente.
 * Nunca habilitar allowedHosts:true: podría facilitar DNS rebinding.
 */
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'')
 const pilotHost=(env.ATLAS_NGROK_HOST||'').trim().toLowerCase()
 if(pilotHost && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(pilotHost))throw Error('ATLAS_NGROK_HOST debe contener únicamente el nombre DNS, sin https:// ni rutas')
 const proxy={'/api':{target:'http://127.0.0.1:3001',changeOrigin:true}}
 return {
  plugins:[react()],
  preview:{host:'127.0.0.1',port:4173,strictPort:true,allowedHosts:pilotHost?[pilotHost]:[],proxy},
  server:{
   host:'127.0.0.1',port:5173,strictPort:true,
   allowedHosts:pilotHost?[pilotHost]:[],
   proxy
  }
 }
})
