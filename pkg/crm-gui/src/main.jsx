import React from 'react'
import ReactDOM from 'react-dom/client'
import { Engine, Syncer, App } from '@dreamcatcher-tech/webdos'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
Debug.enable('iplog webdos:Engine *PulseNet *Announcer Interpulse')

const { VITE_APP_CHAIN_ID, VITE_PEER_ID, VITE_PEER_MULTIADDR } = import.meta.env
console.log('VITE_APP_CHAIN_ID', VITE_APP_CHAIN_ID)
console.log('VITE_PEER_ID', VITE_PEER_ID)
console.log('VITE_PEER_MULTIADDR', VITE_PEER_MULTIADDR)

const { faker } = apps.crm
const makeInit = ({ sectors = 2, customers = 10 } = {}) => {
  faker.customers.reset()
  const install = { add: { path: '/app', installer: '/crm' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/app/customers/batch': { batch: listBatch } }
  const update = { '/app/routing/update': { path: '/app/customers' } }
  const cd = { '/cd': { path: '/app/routing' } }
  return [install, sectorsInsert, listInsert, update, cd]
}

const appRemoteChainId = VITE_APP_CHAIN_ID
const serverPeerId = VITE_PEER_ID
const peers = { [appRemoteChainId]: serverPeerId }
const addrs = [VITE_PEER_MULTIADDR + serverPeerId]
const mounts = { remote: appRemoteChainId }

const dev = { '/crm': apps.crm.covenant }

ReactDOM.createRoot(document.getElementById('root')).render(
  <Engine peers={peers} addrs={addrs} mounts={mounts} dev={dev}>
    <Syncer path="/.mtab/remote">
      <App />
    </Syncer>
  </Engine>
)
