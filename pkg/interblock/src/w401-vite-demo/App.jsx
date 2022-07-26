import React, { useEffect, useState } from 'react'
import { Interpulse } from '..'
import './App.css'
import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('tests:demo')
let shell
const pingRTT = []
let count = 0
function App() {
  const [engine, setEngine] = useState()
  if (!engine) {
    return 'ASDFASDF'
  }
  const [pulseCount, setPulseCount] = useState(0)
  const ping = async () => {
    if (!shell) {
      debug('shell not ready')
      return
    }
    const key = count++
    const entry = { rtt: '(waiting...)', key }
    pingRTT.unshift(entry)
    const pingStart = Date.now()
    const payload = { test: 'ping' }
    const reply = await shell.ping('.', payload)
    debug(`reply: `, reply)
    assert(equal(reply, payload))
    debug(`pong received`)
    const rtt = Date.now() - pingStart
    entry.rtt = rtt
    debug(`ping RTT: ${rtt} ms`)
    const blockCount = shell.metro.getBlockCount()
    setPulseCount(blockCount)
    debug(`blockcount: ${blockCount}`)
    await shell.metro.settle()
    debug(`stop`)
  }

  useEffect(() => {
    Debug.enable('*tests*  *:provenance')
    debug(`start`)
    const boot = async () => {
      const engine = await Interpulse.createCI()
      setEngine((prior) => assert(!prior) && engine)
      debug(`Engine ready`)
      debug(`first ping`)
      await ping()
      debug(`second ping`)
      await ping()
    }
    boot()
    return async () => {
      debug(`shutting down...`)
    }
  }, [])
  return (
    <div className="App">
      <header className="App-header">
        <p>View console logs to see chain tests</p>
        <p>
          <button type="button" onClick={ping}>
            Ping: {count}
          </button>
        </p>
        <p>
          <button type="button" onClick={resetDb}>
            Reset DB
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
        Block Count: {pulseCount}
        <ul>
          {pingRTT.map(({ rtt, key }) => (
            <li key={key}>Ping RTT: {rtt} ms</li>
          ))}
        </ul>
      </header>
    </div>
  )
}

export default App
