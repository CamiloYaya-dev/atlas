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
 // Preview (piloto compilado) SIEMPRE usa la API publicada en 3001.
 // Vite dev usa una API con watch, en 3002. QA puede aislarse en 3003.
 const devApiPort=Number(process.env.ATLAS_DEV_API_PORT||3002)
 const devWebPort=Number(process.env.ATLAS_DEV_WEB_PORT||5173)
 for(const [name,value] of [['ATLAS_DEV_API_PORT',devApiPort],['ATLAS_DEV_WEB_PORT',devWebPort]] as const){
  if(!Number.isInteger(value)||value<1||value>65535)throw Error(`${name} debe ser un puerto válido`)
 }
 const pilotProxy={'/api':{target:'http://127.0.0.1:3001',changeOrigin:true}}
 const devProxy={'/api':{target:`http://127.0.0.1:${devApiPort}`,changeOrigin:true}}
 return {
  plugins:[react()],
  preview:{host:'127.0.0.1',port:4173,strictPort:true,allowedHosts:pilotHost?[pilotHost]:[],proxy:pilotProxy},
  server:{
   host:'127.0.0.1',port:devWebPort,strictPort:true,
   allowedHosts:[],
   proxy:devProxy
  }
 }
})
