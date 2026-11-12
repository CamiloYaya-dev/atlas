import React from 'react'
import {createRoot} from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import '@xyflow/react/dist/style.css'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('ATLAS: no se encontró el contenedor #root')
createRoot(root).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>)
