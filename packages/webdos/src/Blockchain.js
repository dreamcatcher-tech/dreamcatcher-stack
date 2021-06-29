import assert from 'assert'
import React, { useState, useEffect } from 'react'
import { effectorFactory } from '@dreamcatcher-tech/interblock'
import commandLineShell from '@dreamcatcher-tech/dos'
import Debug from 'debug'
import equals from 'fast-deep-equal'
const debug = Debug('terminal:Blockchain')

export const BlockchainContext = React.createContext(null)
BlockchainContext.displayName = 'Blockchain'

const Blockchain = ({
  id = 'terminal',
  context: higherContext,
  dev,
  children,
}) => {
  assert(typeof dev === 'object' || typeof dev === 'undefined')
  const [latest, setLatest] = useState()
  const [context, setContext] = useState()
  const [blockchain, setBlockchain] = useState()
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    let unsubscribeBlocks,
      unsubscribeIsPending,
      isActive = true,
      latestLocal = latest, // TODO must be a cleaner way to do this
      contextLocal = context,
      abortCmd
    const subscribe = async () => {
      debug(`initializing blockchain: ${id}`)
      const covenantOverloads = _extractCovenants(dev)
      const blockchain = await effectorFactory(id, covenantOverloads)
      if (!isActive) {
        // TODO wrap stdin in package attached to blockchain so can be replaced
        debug(`blockchain loaded but torn down`)
        return
      }
      setBlockchain(blockchain)
      const emptyArgs = []
      abortCmd = await commandLineShell(emptyArgs, { blockchain })
      debug(`subscribing to blockchain`)
      unsubscribeBlocks = blockchain.subscribe(() => {
        const blockchainState = blockchain.getState()
        if (!equals(latestLocal, blockchainState)) {
          debug(`setLatest to height: ${blockchainState.provenance.height}`)
          latestLocal = blockchainState
          setLatest(latestLocal)
          if (!equals(blockchainState.state.context, contextLocal)) {
            debug(`setting context %o`, blockchainState.state.context)
            contextLocal = blockchainState.state.context
            setContext(contextLocal)
          }
        }
      })
      unsubscribeIsPending = blockchain.subscribePending((isPending) => {
        debug(`subscribePending`, isPending)
        setIsPending(isPending)
      })
      if (dev) {
        assert.strictEqual(typeof dev, 'object', `dev must be an object`)
        debug(`installing dev mode app`)

        const { dpkgPath } = await blockchain.publish('devApp', dev.installer)
        debug(`dpkgPath: `, dpkgPath)
        const installResult = await blockchain.install(dpkgPath, 'app')

        debug(`app installed: `, installResult)
        await blockchain.cd('/app')
        if (!isActive) {
          debug(`app installed, but blockchain torn down`)
          return
        }
        const command = `ls\n`
        for (const c of command) {
          // TODO fix console not in sync with terminal automatically
          // TODO make writeline command
          process.stdin.send(c)
        }
      }
    }
    subscribe()
    return () => {
      // TODO make the blockchain reject everything, as it is defunct
      isActive = false
      if (unsubscribeBlocks) {
        unsubscribeBlocks()
      }
      if (unsubscribeIsPending) {
        unsubscribeIsPending()
      }
      if (abortCmd) {
        // TODO perhaps all that is requried is to stop DOS ?
        abortCmd()
      }
      debug(`"${id}" has been shut down`)
    }
  }, [id, dev])

  const Context = higherContext || BlockchainContext
  const contextValue = { blockchain, latest, context, isPending }

  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}
const _extractCovenants = (dev) => {
  if (!dev) {
    return
  }
  if (!dev.installer) {
    // TODO assert has covenant format
    return { devApp: dev } // this matches the default installer name in shell
  }
  // TODO extract all covenants from the installer ?
  // TODO assert dev meets covenant format
  assert(dev.covenantId && dev.covenantId.name)
  const name = dev.covenantId.name
  return { [name]: dev }
}
export default Blockchain
