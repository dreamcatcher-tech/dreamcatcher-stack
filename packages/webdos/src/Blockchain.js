import assert from 'assert'
import React, { useState, useEffect } from 'react'
import { effectorFactory } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import equals from 'fast-deep-equal'
import { Terminal } from '.'

const debug = Debug('terminal:Blockchain')

export const BlockchainContext = React.createContext()
BlockchainContext.displayName = 'Blockchain'

const Blockchain = ({ id = 'terminal', dev, children }) => {
  assert(typeof dev === 'object' || typeof dev === 'undefined')
  const [latest, setLatest] = useState()
  const [context, setContext] = useState()
  const [blockchain, setBlockchain] = useState()
  const [isPending, setIsPending] = useState(false)
  const [isBooting, setIsBooting] = useState(true)

  const initializeBlockchain = async () => {
    let isActive = true
    debug(`initializing blockchain: ${id}`)
    const covenantOverloads = _extractCovenants(dev)
    const blockchain = await effectorFactory(id, covenantOverloads)
    if (!isActive) {
      // TODO wrap stdin in package attached to blockchain so can be replaced
      debug(`blockchain loaded but torn down`)
      return
    }
    setBlockchain(blockchain)
    if (dev) {
      assert.strictEqual(typeof dev, 'object', `dev must be an object`)
      debug(`installing dev mode app`)
      const { installer, covenantId } = dev
      const name = covenantId.name
      const { dpkgPath } = await blockchain.publish(name, installer, covenantId)
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
    setTimeout(() => isActive && setIsBooting(false), 100)
    return () => {
      // TODO make the blockchain reject everything, as it is defunct
      isActive = false
      debug(`"${id}" has been shut down`)
    }
  }
  const subscribeToLatestBlock = () => {
    if (!blockchain) {
      return
    }
    const unsubscribe = blockchain.subscribe((block) => {
      debug(`setLatest to height: ${block.provenance.height}`)
      setLatest(block)
      setContext((current) => {
        const { context } = block.state
        if (!equals(context, current)) {
          debug(`setting context %o`, context)
          return context
        }
        return current
      })
    })
    return () => {
      unsubscribe()
    }
  }
  const subscribePending = () => {
    if (!blockchain) {
      return
    }
    const unsubscribeIsPending = blockchain.subscribePending((isPending) => {
      debug(`subscribePending`, isPending)
      setIsPending(isPending)
    })
    return unsubscribeIsPending
  }

  useEffect(() => initializeBlockchain(), [id, dev])
  useEffect(subscribeToLatestBlock, [blockchain])
  useEffect(subscribePending, [blockchain])

  const providerValue = { blockchain, latest, context, isPending }
  // TODO block stdin during this boot time
  return (
    <BlockchainContext.Provider value={providerValue}>
      {isBooting ? (
        <Terminal id="boot" style={{ height: '100vh' }} />
      ) : (
        children
      )}
    </BlockchainContext.Provider>
  )
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
