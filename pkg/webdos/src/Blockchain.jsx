import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('terminal:Blockchain')

export const BlockchainContext = React.createContext()
BlockchainContext.displayName = 'Interpulse'
const Blockchain = ({ repo = 'interpulse', dev, children }) => {
  assert(typeof dev === 'object' || typeof dev === 'undefined')
  const [latest, setLatest] = useState()
  const [state, setState] = useState({})
  const [wd, setWd] = useState('/')
  const [engine, setEngine] = useState()
  const [isPending, setIsPending] = useState(false)
  const [isBooting, setIsBooting] = useState(true)
  const oneShot = useRef(false)
  const engineRef = useRef()
  const init = async () => {
    if (engineRef.current) {
      debug(`awaiting priors`)
      const prior = await engineRef.current
      await prior.stop()
    }
    debug(`init`, engineRef.current)
    engineRef.current = Interpulse.createCI({ repo })
    const engine = await engineRef.current
    globalThis.interpulse = engine
    setEngine(engine)
    setIsBooting(false)
    debug(`Engine ready`)
    for await (const latest of engine.subscribe('/')) {
      assert(latest)
      setLatest(latest)
      const state = latest.getState().toJS()
      setState(state)
      const { wd = '/' } = state
      setWd(wd)
    }
  }
  useEffect(() => {
    if (!oneShot.current) {
      debug(`oneshot React18 workaround`)
      oneShot.current = true
      return
    }
    init()
    return async () => {
      debug('effect cleanup triggered')
      if (engineRef.current) {
        const engine = await engineRef.current
        await engine.stop()
      }
      debug('effect cleanup done')
    }
  }, [])

  const providerValue = { engine, latest, state, wd, isPending }
  return (
    <BlockchainContext.Provider value={providerValue}>
      {isBooting ? <div>booting...</div> : children}
    </BlockchainContext.Provider>
  )
}
Blockchain.propTypes = {
  repo: PropTypes.string,
  dev: PropTypes.object,
  children: PropTypes.node,
}
export default Blockchain
