import React, { useEffect, useState } from 'react'
import { effectorFactory } from '..'
import logo from './logo.svg'
import './App.css'
import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('tests:demo')

function App() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    Debug.enable('*tests*  *:provenance')
    const start = Date.now()
    debug(`start`)
    effectorFactory('inBrowser').then(async (shell) => {
      // client.enableLogging()
      debug(`effector ready`)
      const pingStart = Date.now()
      const payload = { test: 'ping' }
      const reply = await shell.ping('.', payload)
      debug(`reply: `, reply)
      assert(equal(reply, payload))
      debug(`pong received`)
      debug(`ping RTT: ${Date.now() - pingStart} ms`)
      debug(`blockcount: ${shell.metro.getBlockCount()}`)
      debug(`test time: ${Date.now() - start} ms`)
      await shell.metro.settle()
      debug(`stop`)
    })
  }, [])
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Hello Vite + React!</p>
        <p>
          <button type="button" onClick={() => setCount((count) => count + 1)}>
            count is: {count}
          </button>
        </p>
        <p>
          Edit <code>App.jsx</code> and save to test HMR updates.
        </p>
        <p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
          {' | '}
          <a
            className="App-link"
            href="https://vitejs.dev/guide/features.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vite Docs
          </a>
        </p>
      </header>
    </div>
  )
}

export default App
