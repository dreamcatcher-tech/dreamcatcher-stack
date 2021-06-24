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
  identifier = 'terminal',
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
      contextLocal = context
    const subscribe = async () => {
      debug(`initializing blockchain: ${identifier}`)
      const covenantOverloads = dev ? { devApp: dev } : dev
      const blockchain = await effectorFactory(identifier, covenantOverloads)
      if (!isActive) {
        // TODO wrap stdin in package attached to blockchain so can be replaced
        debug(`blockchain loaded but torn down`)
        return
      }
      setBlockchain(blockchain)
      const emptyArgs = []
      commandLineShell(emptyArgs, { blockchain })
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
        const installResult = await blockchain.install(dpkgPath, 'app')
        if (!isActive) {
          debug(`app installed, but blockchain torn down`)
          return
        }
        debug(`app installed: `, installResult)
        await blockchain.cd('/app')
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
      debug(`"${identifier}" has been shut down`)
    }
  }, [identifier, dev])

  const Context = higherContext || BlockchainContext
  const contextValue = { blockchain, latest, context, isPending }

  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}

export default Blockchain
