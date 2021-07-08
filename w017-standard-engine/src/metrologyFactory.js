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
const debugBase = require('debug')('ib:met')
const posix = require('path')
console.log(`posix`, posix)
const _ = require('lodash')
const setImmediate = require('set-immediate-shim')
const { standardEngineFactory } = require('./standardEngineFactory')
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
const covenants = require('../../w212-system-covenants')
const {
  blockModel,
  interblockModel,
  addressModel,
} = require('../../w015-models')
const { piercerFactory } = require('./piercerFactory')
const setImmediateShim = require('set-immediate-shim')

let id = 0
const metrologyFactory = async (identifier, covenantOverloads = {}) => {
  // TODO use metrology in streamProcessor
  assert.strictEqual(typeof covenantOverloads, 'object')
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

  const isolateProcessor = isolateFactory(ioConsistency, covenantOverloads)
  ioIsolate.setProcessor(isolateProcessor)
  const ramDb = ramDynamoDbFactory()
  const ramS3 = ramS3Factory()
  ioConsistency.setProcessor(consistencyFactory(ramDb, ramS3, identifier))
  const tap = enableLoggingWithTap(engine, identifier)

  const baseAddress = await createBase(ioConsistency, sqsPool)

  const metrology = (address, absolutePath) => {
    assert(addressModel.isModel(address))

    const getState = (path = [], height) => {
      if (typeof path === 'number' && height === undefined) {
        height = path
        path = []
      }
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
    const getContext = () => getState(['state', 'context'])
    const getLatest = (chainId) => {
      return new Promise((resolve, reject) => {
        const unsubscribe = subscribeBlockstream(chainId, async (block) => {
          resolve(block)
          await Promise.resolve()
          unsubscribe()
          // TODO handle rejection if we can never resolve the block
        })
      })
    }
    const blockstreamSubscribers = new Map()
    const subscribeBlockstream = (chainId, callback) => {
      initBlockstreamSubscribers(chainId)
      const { subs, latest } = blockstreamSubscribers.get(chainId)
      subs.add(callback)
      if (latest) {
        // TODO avoid setImmediate and make function like redux, for speed
        setImmediateShim(() => callback(latest))
      }
      return () => {
        subs.delete(callback)
        // TODO cleanup by fully removing latest when no subscribers
      }
    }
    const initBlockstreamSubscribers = (chainId, block) => {
      if (!blockstreamSubscribers.has(chainId)) {
        // TODO reuse tap cache or something else lighter than this duplicate
        blockstreamSubscribers.set(chainId, {
          subs: new Set(),
          latest: block,
        })
      }
    }
    const subscribers = new Set()
    const blocks = new Set() // TODO move to using the tap cache
    ioConsistency.subscribe(async (action, queuePromise) => {
      if (action.type === 'UNLOCK') {
        await queuePromise // TODO see if faster without waiting for the promise ?
        const { block } = action.payload
        const chainId = block.getChainId()
        if (!blocks.has(block) && chainId === address.getChainId()) {
          blocks.add(block)
          subscribers.forEach((callback) => callback())
        }
        initBlockstreamSubscribers(chainId, block)
        const streamSubs = blockstreamSubscribers.get(chainId)
        if (!streamSubs.latest || streamSubs.latest.isNext(block)) {
          streamSubs.latest = block
          streamSubs.subs.forEach((callback) => callback(block))
        }
      }
    })
    setImmediateShim(() => subscribers.forEach((callback) => callback()))
    const subscribe = (callback) => {
      assert.strictEqual(typeof callback, 'function')
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }
    const getChildren = () => {
      // TODO make children resolve synchronously and in their own context
      const block = getState()
      const aliases = block.network.getAliases()
      const children = {}
      aliases.forEach((alias) => {
        const channel = block.network[alias]
        if (channel.systemRole === './') {
          const { address } = channel
          const isRoot = absolutePath === '/' // TODO remove this check by normalizing paths
          const childAbsolutePath = isRoot ? alias : absolutePath + '/' + alias
          children[alias] = metrology(address, childAbsolutePath) // TODO dispatch still goes to origin ?
        }
      })
      return children
    }
    const getAbsolutePath = () => absolutePath
    const getChannels = () => {
      const block = getState()
      return block.network
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
    const pierce = piercerFactory(address, ioConsistency, sqsIncrease)
    // TODO remove this function as does not operate on children
    const spawn = (alias, spawnOptions = {}) =>
      pierce(actions.spawn(alias, spawnOptions))
    const getBlockCount = () => tap.getBlockCount()
    const getChainCount = () => tap.getChainCount()
    // TODO getCovenants should return inert json only ?
    const getCovenants = () => isolateProcessor._getCovenants()
    // TODO fortify so can handle not getting full path
    // this might be in wrapping metrology with some kind of interface
    const getActionCreators = async (path) => {
      assert.strictEqual(typeof path, 'string', `path must be a string`)
      assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
      const latest = await getLatestFromPath(path)
      const covenant = _getCovenant(latest, getCovenants())
      // TODO create the functions from the schema, not raw action creators
      if (covenant) {
        return covenant.actions
      }
    }
    const getLatestFromPath = async (path) => {
      // TODO use root hash to walk the known root assured latest
      // walk the tree to get the latest block
      // throw if invalid path
      const segments = _getPathSegments(path)
      let partialPath = segments.shift()
      let chainId = baseAddress.getChainId()
      let nextBlock = await getLatest(chainId)
      while (partialPath !== path) {
        partialPath = segments.shift()
        const alias = partialPath.split('/').pop()
        assert(nextBlock.network[alias].address.isResolved())
        chainId = nextBlock.network[alias].address.getChainId()
        nextBlock = await getLatest(chainId)
      }
      return nextBlock
    }

    return {
      pierce,
      spawn,
      subscribe,
      subscribeBlockstream,
      getLatest,
      getLatestFromPath,
      getState,
      getContext,
      getChildren,
      getAbsolutePath,
      getChannels,
      getEngine,
      getPersistence,
      getChainId,
      getHeight,
      getPool,
      getCovenants,
      settle,
      enableLogging,
      disableLogging,
      getBlockCount,
      getChainCount,
      getActionCreators,
    }
  }
  return metrology(baseAddress, '/')
}
const enableLoggingWithTap = (engine, identifier) => {
  const { sqsPool, sqsTransmit, ioConsistency } = engine
  const debugPrefix = identifier ? `ib:met:${identifier}` : `ib:met`
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
    if (action.type === 'LOCK') {
      const lockStart = Date.now()
      const lock = await queuePromise
      if (lock) {
        tap.lock(action.payload, lockStart)
      }
    }
    if (action.type === 'UNLOCK') {
      await queuePromise
      // TODO check if the children need resyncing ?
      tap.block(action.payload.block)
    }
  })
  return tap
}
const _getCovenant = ({ covenantId }, mergedCovenants) => {
  // TODO allow means to fetch a remote covenant asynchronously
  let covenant = covenants.unity
  if (covenantId.name === 'hyper') {
    return mergedCovenants.hyper //hyper always overridden
  }
  for (const key in mergedCovenants) {
    if (mergedCovenants[key].covenantId.equals(covenantId)) {
      assert(covenant === covenants.unity)
      covenant = mergedCovenants[key]
    }
  }
  return covenant
}
const _getPathSegments = (alias) => {
  // TODO merge with Terminal.utils function
  if (alias === '/') {
    return ['/']
  }
  let prefix = ''
  const splits = alias.split('/').filter((seg) => !!seg)
  splits.unshift('/')
  const paths = splits.map((segment) => {
    prefix && prefix !== '/' && (prefix += '/') // TODO make child naming convention avoid this check ?
    prefix += segment
    return prefix
  })
  return paths
}
module.exports = { metrologyFactory }
