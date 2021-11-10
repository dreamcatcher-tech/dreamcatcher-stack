import assert from 'assert-fast'
import {
  blockModel,
  actionModel,
  channelModel,
  networkModel,
  dmzModel,
  rxRequestModel,
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
  assert(rxRequestModel.isModel(request))
  const [nextDmz, identifier, alias, chainId] = spawnRequester(dmz, request)
  replyPromise() // allows spawnReducer to be reused by deploy reducer
  const originIdentifier = request.identifier
  const subMeta = { type: '@@GENESIS', alias, chainId, originIdentifier }
  const meta = metaProducer.withSlice(dmz.meta, identifier, subMeta)
  return dmzModel.clone({ ...nextDmz, meta })
}
const spawnRequester = (dmz, originAction) => {
  assert(dmzModel.isModel(dmz))
  assert.strictEqual(originAction.type, '@@SPAWN')
  let { alias, spawnOpts } = originAction.payload
  assert(!alias || typeof alias === 'string')
  assert.strictEqual(typeof spawnOpts, 'object')

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  const { network, validators } = dmz
  const covenantId = covenantIdModel.create('unity')
  const childDmz = dmzModel.create({
    network: networkModel.create(),
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

  const genesis = blockModel.create(childDmz)
  const payload = { genesis, alias }
  const genesisRequest = actionModel.create('@@GENESIS', payload)
  const address = genesis.provenance.getAddress()

  let preloadedRequests = []
  if (!channel) {
    channel = channelModel.create(address, './')
  } else {
    preloadedRequests = channel.requests
    channel = channelModel.clone({ ...channel, requests: [] })
    channel = channelProducer.setAddress(channel, address)
    // TODO reresolve the accumulator with identifiers
  }
  channel = channelProducer.txRequest(channel, genesisRequest)
  for (const request of preloadedRequests) {
    channel = channelProducer.txRequest(channel, request)
  }
  const nextNetwork = network.merge({ [alias]: channel })
  const nextDmz = dmzModel.clone({ ...dmz, network: nextNetwork })

  const height = dmz.getCurrentHeight()
  const index = 0
  const expectedReplyIdentifier = `${address.getChainId()}_${height}_${index}`
  assert(!dmz.meta[expectedReplyIdentifier])
  const chainId = genesis.getChainId()
  return [nextDmz, expectedReplyIdentifier, alias, chainId]
}

export { spawn, spawnReducer, spawnRequester }
