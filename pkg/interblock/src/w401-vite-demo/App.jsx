import React, { useEffect, useState } from 'react'
import { effectorFactory } from '..'
import logo from './logo.svg'
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
  const click = async () => {
    if (!shell) {
      debug('shell not ready')
      return
    }
    count++
    const pingStart = Date.now()
    const payload = { test: 'ping' }
    const reply = await shell.ping('.', payload)
    debug(`reply: `, reply)
    assert(equal(reply, payload))
    debug(`pong received`)
    const rtt = Date.now() - pingStart
    pingRTT.unshift({ rtt, count })
    debug(`ping RTT: ${rtt} ms`)
    const blockCount = shell.metro.getBlockCount()
    setBlockCount(blockCount)
    debug(`blockcount: ${blockCount}`)
    await shell.metro.settle()
    debug(`stop`)
  }

  useEffect(() => {
    Debug.enable('*tests*  *:provenance')
    debug(`start`)
    effectorFactory('inBrowser').then(async (blockchain) => {
      // client.enableLogging()
      debug(`effector ready`)
      shell = blockchain
      debug(`first ping`)
      await click()
      debug(`second ping`)
      await click()
    })
  }, [])
  return (
    <div className="App">
      <header className="App-header">
        <p>View console logs to see chain tests</p>
        <p>
          Ping:{' '}
          <button type="button" onClick={click}>
            count is: {count}
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
          {pingRTT.map(({ rtt, count }) => (
            <li key={count}>Ping RTT: {rtt} ms</li>
          ))}
        </ul>
      </header>
    </div>
  )
}

export default App
