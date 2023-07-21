import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { EngineHOC } from '@dreamcatcher-tech/webdos'

export const AppEngine = EngineHOC(App, 'iplog')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppEngine />
  </React.StrictMode>
)
