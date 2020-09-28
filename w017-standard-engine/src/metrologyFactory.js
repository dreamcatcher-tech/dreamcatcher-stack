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
const debugBase = require('debug')('interblock:metrology')
const _ = require('lodash')
const { standardEngineFactory } = require('./standardEngineFactory')
const { dispatchCovenantFactory } = require('./dispatchCovenantFactory')
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
const { shell } = require('../../w212-system-covenants')
const {
  blockModel,
  interblockModel,
  addressModel,
} = require('../../w015-models')
let id = 0
const metrologyFactory = async (identifier, reifiedCovenantMap = {}) => {
  // TODO use metrology in streamProcessor
  assert.strictEqual(typeof reifiedCovenantMap, 'object')
  identifier = identifier || `id-${id++}`
  const debug = debugBase.extend(`${identifier}`)
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
    throw new Error(`injector was not overridden`)
  }
  if (!reifiedCovenantMap.hyper) {
    const hyper = dispatchCovenantFactory(shell.reducer)
    reifiedCovenantMap = { ...reifiedCovenantMap, hyper }
  }
  injector = reifiedCovenantMap.hyper.injector
  ioIsolate.setProcessor(isolateFactory(reifiedCovenantMap))
  const ramDb = ramDynamoDbFactory()
  const ramS3 = ramS3Factory()
  ioConsistency.setProcessor(consistencyFactory(ramDb, ramS3, identifier))
  const tap = enableLoggingWithTap(engine, identifier)
  tap.on()

  const baseAddress = await createBase(ioConsistency, sqsPool)

  const metrology = (address, dispatchPath = '.') => {
    assert(addressModel.isModel(address))

    // TODO change to be plain variables ?
    const dispatch = ({ type, payload, to = dispatchPath }) => {
      debug(`dispatch to: %o type: %O`, to, type)
      const promise = injector({ type, payload, to })
      sqsIncrease.push(baseAddress)
      return promise
    }

    const getState = (path = [], height) => {
      // a synchronous snapshot of the current state of storage
      // TODO pull straight from blocks ?
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
        const block = wbblockbucket[s3Key]
        assert(blockModel.isModel(block))
        let ret = block
        path.forEach((segment) => {
          assert(ret[segment], `No segment: ${segment}`)
          ret = ret[segment]
        })
        return ret
      }
    }
    const getContext = () => getState(['state', 'xstate', 'context'])

    const subscribers = new Set()
    const blocks = new Set()
    ioConsistency.subscribe(async (action, queuePromise) => {
      if (action.type === 'UNLOCK') {
        await queuePromise
        const { block } = action.payload
        if (!blocks.has(block) && block.getChainId() === address.getChainId()) {
          blocks.add(block)
          subscribers.forEach((callback) => callback())
        }
      }
    })
    setImmediate(() => subscribers.forEach((callback) => callback()))
    const subscribe = (callback) => {
      assert.strictEqual(typeof callback, 'function')
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }
    const spawn = (
      alias,
      spawnOptions = {} // TODO replace with 'ADD' into shell covenant
    ) => dispatch(actions.spawn(alias, spawnOptions))
    const getChildren = () => {
      // TODO make children resolve synchronously and in their own context
      const block = getState()
      const aliases = block.network.getAliases()
      const children = {}
      aliases.forEach((alias) => {
        const channel = block.network[alias]
        if (channel.systemRole === './') {
          const { address } = channel
          const childDispatchPath = alias // TODO handle more than first level children
          children[alias] = metrology(address, childDispatchPath) // TODO dispatch still goes to origin ?
        }
      })
      return children
    }
    const getChannels = () => {
      const block = getState()
      const aliases = block.network.getAliases()
      return _.pick(block.network, aliases)
    }
    const getEngine = () => engine
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
    const disableLogging = () => tap.off()
    return {
      dispatch,
      subscribe,
      getState,
      getContext,
      getChildren,
      getChannels,
      getEngine,
      getPersistence,
      getChainId,
      getHeight,
      getPool,
      spawn,
      settle,
      enableLogging,
      disableLogging,
    }
  }
  return metrology(baseAddress)
}
const enableLoggingWithTap = (engine, identifier) => {
  const { sqsPool, sqsTransmit, ioConsistency } = engine
  debugPrefix = identifier
    ? `interblock:metrology:${identifier}`
    : `interblock:metrology`
  const tap = createTap(debugPrefix)
  sqsPool.subscribe(async (action, queuePromise) => {
    // await queuePromise
    // tap.interblockPool(action)
  })
  sqsTransmit.subscribe(async (action, queuePromise) => {
    // await queuePromise
    // tap.interblockTransmit(action)
  })

  ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      await queuePromise
      // TODO check if the children need resyncing ?
      tap.block(action.payload.block)
    }
  })
  return tap
}

module.exports = { metrologyFactory }
