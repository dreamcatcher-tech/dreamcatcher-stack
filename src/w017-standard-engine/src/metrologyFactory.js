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

import { assert } from 'chai/index.mjs'
import posix from 'path-browserify'
import last from 'lodash.last'
import setImmediate from 'set-immediate-shim'
import { standardEngineFactory } from './standardEngineFactory'
import { isolateFactory } from './services/isolateFactory'
import {
  consistencyFactory,
  ramDynamoDbFactory,
  ramS3Factory,
  s3Keys,
} from './services/consistencyFactory'
import { createBase } from './execution/createBase'
import { createTap } from './execution/tap'
import { actions } from '../../w021-dmz-reducer'
import * as covenants from '../../w212-system-covenants'
import { blockModel, interblockModel, addressModel } from '../../w015-models'
import { piercerFactory } from './piercerFactory'
import Debug from 'debug'
const debugBase = Debug('ib:met')

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

    const getState = (height) => {
      // a synchronous snapshot of the current state of storage
      // TODO pull straight from blocks ?
      return _getBlock(address.getChainId(), height)
    }
    const getContext = () => {
      const block = getState()
      return block.state.context
    }
    const getLatest = async (chainId) => {
      let latest, asyncLatest
      const unsubscribe = subscribeBlockstream(chainId, (block) => {
        latest = block
        if (asyncLatest) {
          asyncLatest(block)
        }
        // TODO handle rejection if we can never resolve the block
      })
      if (latest) {
        unsubscribe()
        return latest
      }
      return new Promise((resolve, reject) => {
        asyncLatest = (block) => {
          unsubscribe()
          resolve(block)
        }
      })
    }
    const blockstreamSubscribers = new Map()
    const subscribeBlockstream = (chainId, callback) => {
      initBlockstreamSubscribers(chainId)
      const { subs, latest } = blockstreamSubscribers.get(chainId)
      subs.add(callback)
      if (latest) {
        callback(latest)
      }
      return () => {
        subs.delete(callback)
        // TODO cleanup by fully removing latest when no subscribers
        // but waiting on some way to recover if subscribe again
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
    ioConsistency.subscribe(async (action, queuePromise) => {
      if (action.type === 'UNLOCK') {
        await queuePromise // TODO see if faster without waiting for the promise ?
        const { block } = action.payload
        const chainId = block.getChainId()
        initBlockstreamSubscribers(chainId, block)
        const streamSubs = blockstreamSubscribers.get(chainId)
        if (!streamSubs.latest || streamSubs.latest.isNext(block)) {
          // TODO warning if subscribe to latest before it gets generated
          streamSubs.latest = block
          streamSubs.subs.forEach((callback) => callback(block))
        }
      }
    })
    const getChildren = () => {
      // TODO remove this function completely
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
    const getChainId = () => address.getChainId()
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
        return covenant.actions || {}
      }
    }
    // TODO make height be special case to get latest or next
    const getLatestFromPath = async (path, height = -1) => {
      // TODO use root hash to walk the known root assured latest
      // walk the tree to get the latest block
      // throw if invalid path
      assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
      assert(Number.isInteger(height))
      assert(height >= -1)
      const segments = _getPathSegments(path)
      let alias = segments.shift()
      let chainId = baseAddress.getChainId()
      let nextBlock = await getLatest(chainId)
      while (segments.length) {
        alias = segments.shift()
        assert(nextBlock.network[alias].address.isResolved())
        chainId = nextBlock.network[alias].address.getChainId()
        nextBlock = await getLatest(chainId)
      }
      if (height === -1 || height === nextBlock.getHeight()) {
        return nextBlock
      }
      if (height > nextBlock.getHeight()) {
        // TODO subscribe, seek, or otherwise find if height insufficient
      }
      // TODO fetch from other block producers
      return _getBlock(nextBlock.getChainId(), height)
    }
    const _getBlock = (chainId, height) => {
      if (typeof height !== 'undefined') {
        assert(Number.isInteger(height))
        assert(height >= -1)
      }
      const { dbChains } = ramDb._getTables()
      const chain = dbChains[chainId] || {}
      let blockItem
      if (height === undefined) {
        blockItem = last(Object.values(chain))
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
        return block
      }
    }
    return {
      pierce,
      spawn,
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
  const splits = alias.split('/').filter((seg) => !!seg)
  splits.unshift('/')
  return splits
}
export { metrologyFactory }
