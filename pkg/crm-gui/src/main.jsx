import PropTypes from 'prop-types'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Engine, Syncer, App } from '@dreamcatcher-tech/webdos'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
Debug.enable('iplog *Lifter *Announcer *Syncer')

const { VITE_APP_CHAIN_ID, VITE_PEER_ID, VITE_PEER_MULTIADDR } = import.meta.env
console.log('VITE_APP_CHAIN_ID', VITE_APP_CHAIN_ID)
console.log('VITE_PEER_ID', VITE_PEER_ID)
console.log('VITE_PEER_MULTIADDR', VITE_PEER_MULTIADDR)

const appRemoteChainId = VITE_APP_CHAIN_ID
const serverPeerId = VITE_PEER_ID
const peers = { [appRemoteChainId]: serverPeerId }
const addrs = [VITE_PEER_MULTIADDR + serverPeerId]
const mounts = { remote: appRemoteChainId }

const dev = { '/crm': apps.crm.covenant }
const a = [{ '/cd': { path: '/.mtab/remote/customers', allowVirtual: true } }]

const Test = ({ crisp }) => {
  const [prior, setPrior] = React.useState()
  const [count, setCount] = React.useState(0)
  const [start] = React.useState(Date.now())
  const [lastMs, setLastMs] = React.useState(Date.now())
  const [priorMs, setPriorMs] = React.useState(0)
  const [now, setNow] = React.useState(Date.now())
  if (prior !== crisp) {
    setPrior(crisp)
    setCount(count + 1)
    setLastMs(Date.now())
    setPriorMs(Date.now() - lastMs)
  }
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 100)
    return () => clearInterval(interval)
  }, [])
  const total = crisp.isDeepLoaded ? lastMs - start : now - start
  return (
    <div>
      <h1>isDeepLoaded: {JSON.stringify(crisp.isDeepLoaded)}</h1>
      <h1>crisp count: {count}</h1>
      <h1>crisp last time: {priorMs}ms</h1>
      <h1>crisp total time: {total}ms</h1>
    </div>
  )
}
Test.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

ReactDOM.createRoot(document.getElementById('root')).render(
  <Engine peers={peers} addrs={addrs} mounts={mounts} dev={dev} ram actions={a}>
    <Syncer path="/.mtab/remote">
      {/* <App /> */}
      <Test />
    </Syncer>
  </Engine>
)
