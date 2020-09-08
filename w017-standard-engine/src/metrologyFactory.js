/**
 * Toolkit to load up chain scenarios and analyze their structure.
 * Also permits advancing the chain using the Standard Engine,
 * so used to test and enhance the Standard Engine.
 *
 * Metrology:
 * const chain1 = await
 * genesis() // makes a new root chain
 * .dispatch(action) // using api action creators
 * .spawn('spawnPath')
 * .connect('meow', address)
 * .dispatch(action1)
 * .reply( reply1 )
 * .reply()
 *
 * const chain2 = chain1.spawnPath
 * const request = chain2.receive()
 * chain2.reply( reply )
 * chain1.sync( chain2 ) // transmit and process interblocks as they are available
 * chain2.sync( chain1 )
 *
 * const lineage = chain1.lineage( fromHeight, toHeight )
 * const interblock =chain1.interblock( fromHeight, alias ) // makes interblock from this height
 * const address = chain1.getAddress()
 * chain1.rollback( 5 ) // go back to a previous block being current
 * chain1.getRequests(alias)
 *
 */

const assert = require('assert')
const debug = require('debug')('interblock:metrology')
const _ = require('lodash')
const { standardEngineFactory } = require('./standardEngineFactory')
const dispatchCovenantFactory = require('./dispatchCovenantFactory')
const { isolateFactory } = require('./services/isolateFactory')
const {
  consistencyFactory,
  ramDynamoDbFactory,
  ramS3Factory,
  s3Keys,
} = require('./services/consistencyFactory')
const { createBase } = require('./execution/createBase')
const { createTap } = require('./execution/tap')
const { actions } = require('../../w021-dmz-reducer')
const {
  blockModel,
  interblockModel,
  addressModel,
} = require('../../w015-models')

const metrologyFactory = (identifier, reifiedCovenantMap = {}) => {
  // TODO use metrology in streamProcessor
  debug(`metrologyFactory`)
  const engine = standardEngineFactory()
  const {
    sqsTx,
    sqsRx,
    sqsTransmit,
    sqsPool,
    sqsIncrease,
    ioCrypto,
    ioIsolate,
    ioConsistency,
    ioPool,
    ioIncrease,
  } = engine

  let injector = () => {
    throw new Error(`injector was overridden`)
  }
  if (!reifiedCovenantMap.hyper) {
    const hyper = dispatchCovenantFactory()
    injector = hyper.injector
    reifiedCovenantMap = { hyper }
  }
  ioIsolate.setProcessor(isolateFactory(reifiedCovenantMap))
  const ramDb = ramDynamoDbFactory()
  const ramS3 = ramS3Factory()
  ioConsistency.setProcessor(consistencyFactory(ramDb, ramS3, identifier))
  const tap = enableLoggingWithTap(engine, identifier)
  tap.on()
  const initializePromise = createBase(ioConsistency, sqsPool)

  /** Fluent interfaces
   * Three kinds of function:
   * 1. dispatch, which resolves with its actual result
   * 2. promisers, which resolve with all the functions of the toolkit
   * 3. getters, which resolve if called from a promise, or return their results directly
   *
   * If a promise is returned, then all functions on it return a promise.
   * At the start, the engine must finish initializing before any of the decorated functions can execute
   *
   * getChildren needs to return a new interface that has baseAddress set to one of the children
   */

  const makeBaseFunctions = async (baseAddressPromise) => {
    const address =
      typeof baseAddressPromise.then === 'function'
        ? await baseAddressPromise
        : baseAddressPromise
    assert(addressModel.isModel(address))
    const dispatchMany = (...actions) => {
      const promises = actions.map(({ type, payload, to = '.' }) => {
        debug(`dispatch to: %o action: %O`, to, type)
        return injector({ type, payload, to })
      })
      sqsIncrease.push(address)
      return Promise.all(promises)
    }

    // TODO change to be plain variables ?
    const dispatch = ({ type, payload, to = '.' }) => {
      debug(`dispatch to: %o type: %O payload: %O`, to, type, payload)
      const promise = injector({ type, payload, to })
      sqsIncrease.push(address)
      return promise
    }

    const getState = (height) => {
      // a synchronous snapshot of the current state of storage
      const { dbChains } = ramDb._getTables()
      const chain = dbChains[address.getChainId()] || {}
      let blockItem
      if (height === undefined) {
        blockItem = _.last(Object.values(chain))
      } else {
        if (!chain[height]) {
          throw new Error(`out of bounds: ${height} ${chain.length}`)
        }
        blockItem = chain[height]
      }
      if (blockItem) {
        const s3Key = s3Keys.fromBlockItem(blockItem)
        const { wbblockbucket } = ramS3._getBuckets()
        const jsonBlock = wbblockbucket[s3Key]
        assert(jsonBlock)
        return blockModel.clone(jsonBlock)
      }
    }

    const subscribers = new Set()
    const blocks = new Set()
    ioConsistency.subscribe(async (action, queuePromise) => {
      if (action.type === 'UNLOCK') {
        await queuePromise
        const { block } = action.payload
        if (!blocks.has(block)) {
          blocks.add(block)
          subscribers.forEach((callback) => callback())
        }
      }
    })
    const subscribe = (callback, path = '.') => {
      // TODO handle path
      assert.equal(typeof callback, 'function')
      assert.equal(typeof path, 'string')
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }

    const spawn = (alias, spawnOptions = {}) =>
      dispatch(actions.spawn(alias, spawnOptions))
    const getChildren = () => {
      // TODO make children resolve directly
      const block = getState()
      const aliases = block.network.getAliases()
      const children = {}
      aliases.map((alias) => {
        const channel = block.network[alias]
        if (channel.systemRole === './') {
          const { address } = channel
          children[alias] = metrology(address)
        }
      })
      return children
    }
    const getParent = () => {}
    const getSelf = () => {}
    const getChannels = () => {
      const block = getState()
      const aliases = block.network.getAliases()
      return _.pick(block.network, aliases)
    }
    const getEngine = () => ({ ...engine })
    const getPersistence = () => ioConsistency.getProcessor().persistence
    const getChainId = () => getState().provenance.getAddress().getChainId()
    const getHeight = () => getState().provenance.height
    const getPool = () => {
      // a synchronous snapshot of the current state of storage
      const { dbPools } = ramDb._getTables()
      const chainId = address.getChainId()
      const partition = dbPools[chainId]
      const items = Object.values(partition)
      const s3InterblockKeys = items.map(s3Keys.fromPoolItem)
      const { wbinterbucket } = ramS3._getBuckets()
      const interblocks = s3InterblockKeys.map((s3Key) => {
        const jsonInterblock = wbinterbucket[s3Key]
        assert(jsonInterblock)
        return interblockModel.clone(jsonInterblock)
      })
      return interblocks
    }
    const settle = async (enginePair) => {
      const queues = Object.values(engine)
      while (queues.some((q) => q.length() || q.awaitingLength())) {
        const awaits = queues.map((q) => q.settle())
        await Promise.all(awaits)
        await new Promise(setImmediate)
        if (enginePair) {
          await enginePair.settle()
        }
      }
    }
    const enableLogging = () => tap.on()
    return {
      dispatch,
      getState,
      subscribe,
      getChildren,
      getParent,
      getSelf,
      getChannels,
      getEngine,
      getPersistence,
      getChainId,
      getHeight,
      getPool,
      spawn,
      settle,
      enableLogging,
    }
  }

  const metrology = (baseAddressPromise) => {
    const makeBasePromise = makeBaseFunctions(baseAddressPromise)
    const functions = [
      'dispatch',
      'getState',
      'getChildren',
      'getParent',
      'getSelf',
      'getChannels',
      'getEngine',
      'getPersistence',
      'getChainId',
      'getHeight',
      'getPool',
      'settle',
      'enableLogging',
      'spawn',
    ]
    const passThrus = ['spawn']
    const decorate = (promise) => {
      assert(typeof promise.then === 'function')
      functions.map((name) => {
        promise[name] = (...args) => {
          const awaiter = async (...args) => {
            // debug(`awaiter: ${name}`)
            const baseFunctions = await makeBasePromise
            await promise
            const result = baseFunctions[name](...args)
            // debug(`result: ${name}`)
            if (result && typeof result.then === 'function') {
              if (name !== 'dispatch') {
                const resolveOverride = async () => {
                  await result
                  // debug(`resolveOverride: ${name}`)
                  return baseFunctions
                }
                return decorate(resolveOverride())
              }
              // debug(`dispatch being decorated: ${name}`)
              return decorate(result)
            } else if (passThrus.includes(name)) {
              return baseFunctions
            } else {
              return result
            }
          }
          const awaiterPromise = awaiter(...args)
          return decorate(awaiterPromise)
        }
      })
      return promise
    }
    return decorate(makeBasePromise)
  }
  return metrology(initializePromise)
}
const enableLoggingWithTap = (engine, identifier) => {
  const { sqsPool, sqsTransmit, ioConsistency } = engine
  debugPrefix = identifier
    ? `interblock:metrology:${identifier}`
    : `interblock:metrology`
  const tap = createTap(debugPrefix)
  sqsPool.subscribe(async (action, queuePromise) => {
    // await queuePromise
    tap.interblockPool(action)
  })
  sqsTransmit.subscribe(async (action, queuePromise) => {
    // await queuePromise
    tap.interblockTransmit(action)
  })

  ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      await queuePromise
      tap.block(action.payload.block)
    }
  })
  return tap
}

module.exports = { metrologyFactory }
