import React, { useEffect, useState } from 'react'
import { effectorFactory } from '..'
import './App.css'
import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('tests:demo')
let shell
const pingRTT = []
let count = 0
function App() {
  const [blockCount, setBlockCount] = useState(0)
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
    setBlockCount(blockCount)
    debug(`blockcount: ${blockCount}`)
    await shell.metro.settle()
    debug(`stop`)
  }
  const resetDb = async () => {
    if (!shell) {
      debug('shell not ready')
      return
    }
    await shell.dropDb()
    debug('resetDb done')
  }

  useEffect(() => {
    Debug.enable('*tests*  *:provenance')
    debug(`start`)
    const identifier = 'vite-test'
    const overloads = {}
    const dbName = 'test-idb'
    effectorFactory(identifier, overloads, dbName).then(async (blockchain) => {
      // client.enableLogging()
      debug(`effector ready`)
      shell = blockchain
      debug(`first ping`)
      await ping()
      debug(`second ping`)
      await ping()
    })
    return async () => {
      debug(`shutting down...`)
      await shell.shutdown()
      debug(`shutdown complete`)
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
        Block Count: {blockCount}
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
