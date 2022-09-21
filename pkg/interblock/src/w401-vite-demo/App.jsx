import React, { useEffect, useState, useRef } from 'react'
import { Interpulse } from '..'
import './App.css'
import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('tests:demo')
Debug.enable('tests* ipfs* interpulse *Endurance')
debug('import loaded')
const repo = 'interpulse-test'
function App() {
  const [engine, setEngine] = useState()
  const [pulseCount, setPulseCount] = useState(0)
  const [pingRTT, setPingRTT] = useState([])

  const ping = async () => {
    const key = pingRTT.length
    const entry = { rtt: '(waiting...)', key }
    pingRTT.unshift(entry)
    setPingRTT(pingRTT)
    const pingStart = Date.now()
    const payload = { test: 'ping' }
    const reply = await engine.ping('.', payload)
    debug(`reply: `, reply)
    assert(equal(reply, payload))
    debug(`pong received`)
    const rtt = Date.now() - pingStart
    entry.rtt = rtt
    debug(`ping RTT: ${rtt} ms`)
    const pulseCount = engine.logger.pulseCount
    setPulseCount(pulseCount)
    debug(`pulsecount: ${pulseCount}`)
    const latest = await engine.latest()
    debug(`pulse hash`, latest.cid.toString())
    debug(`stop`)
  }
  const oneShot = useRef(false)
  const init = async (engine) => {
    if (engine) {
      debug(`awaiting priors`)
      await engine.stop()
    }
    debug(`init`)
    const newEngine = await Interpulse.createCI({ repo })
    setEngine(newEngine)
    debug(`Engine ready`)
  }
  useEffect(() => {
    if (!oneShot.current) {
      debug(`oneshot React18 workaround`)
      oneShot.current = true
      return
    }
    // Debug.enable('*tests*  *:provenance')
    init(engine)
  }, [])

  if (!engine) {
    return 'ENGINE LOADING...'
  }
  if (!pingRTT.length) {
    const initialPings = async () => {
      debug(`first ping`)
      await ping()
      debug(`second ping`)
      await ping()
      debug(`initialPings done`)
    }
    initialPings()
  }
  const reset = async () => {
    debug(`resetting db...`)
    setEngine()
    await engine.stop()
    const dbs = await window.indexedDB.databases()
    const awaits = []
    for (const db of dbs) {
      debug(`deleting`, db)
      const request = window.indexedDB.deleteDatabase(db.name)
      awaits.push(
        new Promise((resolve, reject) => {
          request.onerror = reject
          request.onsuccess = resolve
        }).then(() => debug(`deleted`, db))
      )
    }
    await Promise.all(awaits)
    debug(`reset complete`)
    setPingRTT([])
    init()
  }
  return (
    <div className="App">
      <header className="App-header">
        <p>View console logs to see chain tests</p>
        <p>
          <button type="button" onClick={ping}>
            Ping: {pingRTT.length}
          </button>
        </p>
        <p>
          <button type="button" onClick={reset}>
            Reset DB
          </button>
        </p>
        <p>
          <button
            type="button"
            onClick={async () => {
              const latest = await engine.latest()
              latest.dir()
              debug(latest.cid.toString())
              debug(latest.getAddress().cid.toString())
            }}
          >
            Dump latest to console
          </button>
        </p>
        <p>
          <button
            type="button"
            onClick={async () => {
              const stats = await engine.stats()
              debug('stats', stats)
              debug('repo', stats.repo)
              debug('bitswap', stats.bitswap)
              debug('net', stats.net)
            }}
          >
            Stats
          </button>
        </p>
        <p>
          <a
            className="App-link"
            href="https://vitejs.dev/guide/features.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vite Docs
          </a>
        </p>
        Pulse Count: {pulseCount}
        <ol>
          {pingRTT.map(({ rtt, key }) => (
            <li key={key}>Ping RTT: {rtt} ms</li>
          ))}
        </ol>
      </header>
    </div>
  )
}

export default App
