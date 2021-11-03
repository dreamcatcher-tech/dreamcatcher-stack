import assert from 'assert-fast'
import {
  blockModel,
  actionModel,
  channelModel,
  interblockModel,
  networkModel,
  dmzModel,
  rxRequestModel,
  covenantIdModel,
} from '../../w015-models'
import { channelProducer } from '../../w016-producers'
import { autoAlias } from './utils'
import { replyPromise } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:spawn')

const spawn = (alias, spawnOpts = {}, actions = []) => {
  const action = {
    type: '@@SPAWN',
    payload: { alias, spawnOpts, actions },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}

const spawnReducer = (dmz, originAction) => {
  assert(rxRequestModel.isModel(originAction))
  const nextDmz = spawnReducerWithoutPromise(dmz, originAction)
  replyPromise() // allows spawnReducer to be reused by deploy reducer
  return nextDmz
}
const spawnReducerWithoutPromise = (dmz, originAction) => {
  assert(dmzModel.isModel(dmz))
  assert(rxRequestModel.isModel(originAction))
  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  let { alias, spawnOpts } = originAction.payload
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
  // TODO use chain key for signing

  const genesis = blockModel.create(childDmz)
  const payload = { genesis, alias, originAction }
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
  const height = dmz.getCurrentHeight()
  dmz = { ...dmz }
  dmz.network = network.merge({ [alias]: channel })

  const index = 0
  const expectedReplyIdentifier = `${address.getChainId()}_${height}_${index}`
  assert(!dmz.meta[expectedReplyIdentifier])
  dmz.meta = { ...dmz.meta, [expectedReplyIdentifier]: originAction.identifier }

  return dmzModel.clone(dmz)
}

export { spawn, spawnReducer, spawnReducerWithoutPromise }
