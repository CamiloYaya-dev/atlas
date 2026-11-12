import React from 'react'
import type {ErrorInfo,ReactNode} from 'react'

type Props={children:ReactNode}
type State={error:Error|null,stack:string}

// Un fallo de render no debe dejar la pantalla completamente blanca.
export default class ErrorBoundary extends React.Component<Props,State>{
 state:State={error:null,stack:''}
 static getDerivedStateFromError(error:Error):State{return {error,stack:''}}
 componentDidCatch(error:Error,info:ErrorInfo){
  console.error('[ATLAS] Error al renderizar la aplicación:',error,info.componentStack)
  this.setState({stack:info.componentStack||''})
 }
 render(){
  if(!this.state.error)return this.props.children
  const details=`${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack||''}\n${this.state.stack}`
  return <main style={{minHeight:'100vh',padding:32,background:'#f4f7fb',color:'#24344d',fontFamily:'system-ui,sans-serif'}}>
   <section style={{maxWidth:780,margin:'8vh auto',padding:30,background:'#fff',border:'1px solid #dce5f1',borderRadius:16,boxShadow:'0 12px 42px #182b4812'}}>
    <strong style={{fontSize:12,letterSpacing:2,color:'#4067a9'}}>ATLAS · DIAGNÓSTICO</strong>
    <h1 style={{marginBottom:8}}>La aplicación encontró un error</h1>
    <p>El servidor puede seguir funcionando, pero React no pudo dibujar esta pantalla. Copia el mensaje de abajo para identificar el problema. <strong>No borres tus diagramas ni el almacenamiento del navegador.</strong></p>
    <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:310,overflow:'auto',background:'#142039',color:'#e7f0ff',padding:16,borderRadius:10,fontSize:12}}>{details}</pre>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:20}}>
     <button onClick={()=>void navigator.clipboard?.writeText(details)} style={{padding:'10px 16px',borderRadius:8,border:'1px solid #c5d3e7',background:'#eef5ff'}}>Copiar diagnóstico</button>
     <button onClick={()=>window.location.reload()} style={{padding:'10px 16px',borderRadius:8,border:0,background:'#315fcd',color:'#fff'}}>Recargar</button>
    </div>
   </section>
  </main>
 }
}
