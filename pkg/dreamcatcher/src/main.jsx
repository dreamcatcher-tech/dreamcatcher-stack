import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { EngineHOC } from '@dreamcatcher-tech/webdos'
import * as app from './covenants/app'
import {
  generatePacketBatch,
  generateDraftBatch,
  generateChangeBatch,
} from './covenants/faker'
const pBatch = { '/app/packets/batch': { batch: generatePacketBatch(10) } }
const dBatch = { '/app/drafts/batch': { batch: generateDraftBatch(10) } }
const cBatch = { '/app/changes/batch': { batch: generateChangeBatch(10) } }

export const AppEngine = EngineHOC(App, 'iplog')

const add = { add: { path: '/app', installer: '/dpkg/app' } }
const cd = { cd: { path: '/app/packets' } }
const init = [add, pBatch, dBatch, cBatch, cd]

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppEngine dev={{ '/dpkg/app': app }} path="/app" init={init} />
  </React.StrictMode>
)
