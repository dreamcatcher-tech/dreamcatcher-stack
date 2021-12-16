import assert from 'assert-fast'
import {
  Block,
  Action,
  Channel,
  Network,
  Dmz,
  RxRequest,
  covenantIdModel,
} from '../../w015-models'
import { channelProducer, metaProducer } from '../../w016-producers'
import { autoAlias } from './utils'
import { replyPromise } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:spawn')

const spawn = (alias, spawnOpts = {}) => {
  const action = {
    type: '@@SPAWN',
    payload: { alias, spawnOpts },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}

const spawnReducer = (dmz, request) => {
  assert(request instanceof RxRequest)
  const [nextDmz, identifier, alias, chainId] = spawnRequester(dmz, request)
  replyPromise() // allows spawnReducer to be reused by deploy reducer
  const originIdentifier = request.identifier
  const subMeta = { type: '@@GENESIS', alias, chainId, originIdentifier }
  const meta = metaProducer.withSlice(dmz.meta, identifier, subMeta)
  return Dmz.clone({ ...nextDmz, meta })
}
const spawnRequester = (dmz, originAction) => {
  assert(dmz instanceof Dmz)
  assert.strictEqual(originAction.type, '@@SPAWN')
  let { alias, spawnOpts } = originAction.payload
  assert(!alias || typeof alias === 'string')
  assert.strictEqual(typeof spawnOpts, 'object')

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  const { network, validators } = dmz
  const covenantId = covenantIdModel.create('unity')
  const childDmz = Dmz.create({
    network: Network.create(),
    covenantId,
    ...spawnOpts,
    validators,
  })
  debug(`spawn alias: ${alias}`)
  alias = !alias ? autoAlias(network) : alias
  assert(!alias.includes('/'), `No / character allowed in "${alias}"`)
  if (alias === '.' || alias === '..') {
    throw new Error(`Alias uses reserved name: ${alias}`)
  }
  let channel = network[alias]
  if (channel && !channel.address.isUnknown()) {
    throw new Error(`childAlias exists: ${alias}`)
  }
  // TODO insert dmz.getHash() into create() to generate repeatable randomness

  const genesis = Block.create(childDmz)
  const payload = { genesis, alias }
  const genesisRequest = Action.create('@@GENESIS', payload)
  const address = genesis.provenance.getAddress()

  let preloadedRequests = []
  if (!channel) {
    channel = Channel.create(address, './')
  } else {
    preloadedRequests = channel.requests
    channel = Channel.clone({ ...channel, requests: [] })
    channel = channelProducer.setAddress(channel, address)
    // TODO reresolve the accumulator with identifiers
  }
  channel = channelProducer.txRequest(channel, genesisRequest)
  for (const request of preloadedRequests) {
    channel = channelProducer.txRequest(channel, request)
  }
  const nextNetwork = network.merge({ [alias]: channel })
  const nextDmz = Dmz.clone({ ...dmz, network: nextNetwork })

  const height = dmz.getCurrentHeight()
  const index = 0
  const expectedReplyIdentifier = `${address.getChainId()}_${height}_${index}`
  assert(!dmz.meta[expectedReplyIdentifier])
  const chainId = genesis.getChainId()
  return [nextDmz, expectedReplyIdentifier, alias, chainId]
}

export { spawn, spawnReducer, spawnRequester }
