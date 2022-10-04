import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import equals from 'fast-deep-equal'
import { Terminal } from '.'
import process from 'process'
import Debug from 'debug'
const debug = Debug('terminal:Blockchain')

export const BlockchainContext = React.createContext()
BlockchainContext.displayName = 'Blockchain'
const Blockchain = ({ repo = 'interpulse', dev, children }) => {
  assert(typeof dev === 'object' || typeof dev === 'undefined')
  const [latest, setLatest] = useState()
  const [state, setState] = useState()
  const [engine, setEngine] = useState()
  const [isPending, setIsPending] = useState(false)
  const [isBooting, setIsBooting] = useState(true)

  const oneShot = useRef(false)
  const init = async (engine) => {
    if (engine) {
      debug(`awaiting priors`)
      await engine.stop()
    }
    debug(`init`)
    const newEngine = await Interpulse.createCI({ repo })
    setEngine(newEngine)
    setIsBooting(false)
    console.log(await newEngine.latest())
    debug(`Engine ready`)
  }
  useEffect(() => {
    if (!oneShot.current) {
      debug(`oneshot React18 workaround`)
      oneShot.current = true
      return
    }
    init(engine)
  }, [])

  const providerValue = { engine, latest, state, isPending }
  return (
    <BlockchainContext.Provider value={providerValue}>
      {isBooting ? <div>booting...</div> : children}
    </BlockchainContext.Provider>
  )
}
export default Blockchain
