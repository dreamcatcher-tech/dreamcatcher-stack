import React, { useEffect, useState, useRef } from 'react'
import { Interpulse } from '..'
import './App.css'
import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('tests:demo')
Debug.enable('tests* ipfs interpulse')
debug('import loaded')

function App() {
  const [engine, setEngine] = useState()
  const [pulseCount, setPulseCount] = useState(0)
  const [pingRTT, setPingRTT] = useState([])

  const ping = async () => {
    assert(engine.latest)
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
    debug(`stop`)
  }
  const oneShot = useRef(false)
  useEffect(() => {
    if (!oneShot.current) {
      debug(`oneshot React18 workaround`)
      oneShot.current = true
      return
    }
    // Debug.enable('*tests*  *:provenance')
    const init = async () => {
      debug(`init`)
      const engine = await Interpulse.createCI()
      setEngine((prior) => assert(!prior) || engine)
      debug(`Engine ready`)
    }
    init()
    return async () => {
      debug(`shutting down...`)
      setEngine()
    }
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
          <button type="button" onClick={() => console.log('reset')}>
            Reset DB
          </button>
        </p>
        <p>
          <button type="button" onClick={() => engine.ipfsStart()}>
            Start IPFS
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
