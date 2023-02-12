import React from 'react'
import ReactDOM from 'react-dom/client'
import { Engine, Syncer, App } from '@dreamcatcher-tech/webdos'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

Debug.enable('iplog webdos:Engine *libp2p* *PulseNet Interpulse')

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

const appRemoteChainId = 'QmdPGintwAps6KjRLBYkd3sNBcwmDNgFXJzReyrUgHHDdj'
const serverPeerId = '16Uiu2HAmCd9KKpPA1AMTCAMcbpsNS3i9cT79k9xAF35Bh14i4xpu'
const peers = { [appRemoteChainId]: serverPeerId }
const addrs = ['/ip4/127.0.0.1/tcp/3000/ws/p2p/' + serverPeerId]
const mounts = { remote: appRemoteChainId }

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <table>
      <tbody>
        <tr>
          <td width={'200px'}>App remote chain ID</td>
          <td>
            <pre>{appRemoteChainId}</pre>
          </td>
        </tr>
        <tr>
          <td>Server peer ID</td>
          <td>
            <pre>{serverPeerId}</pre>
          </td>
        </tr>
        <tr>
          <td>Chain Peers mapping</td>
          <td>
            <pre>{Object.entries(peers).pop().join(' : ')}</pre>
          </td>
        </tr>
        <tr>
          <td>Server address</td>
          <td>
            <pre>{addrs[0]}</pre>
          </td>
        </tr>
      </tbody>
    </table>
    <Engine peers={peers} addrs={addrs} mounts={mounts} ram reset>
      <Syncer path="/.mtab/remote">
        <App />
      </Syncer>
    </Engine>
  </>
)
