const assert = require('assert')
const debug = require('debug')('interblock:dmz:spawn')
const {
  blockModel,
  actionModel,
  channelModel,
  interblockModel,
  txRequestModel,
  networkModel,
  dmzModel,
  rxRequestModel,
} = require('../../w015-models')
const { channelProducer, networkProducer } = require('../../w016-producers')
const { autoAlias } = require('./utils')
const { effectInBand, replyPromise } = require('../../w002-api')

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

const spawnReducer = async (dmz, originAction) => {
  assert(rxRequestModel.isModel(originAction))
  const network = await spawnReducerWithoutPromise(dmz, originAction)
  replyPromise() // allows spawnReducer to be reused by deploy
  return network
}
const spawnReducerWithoutPromise = async (dmz, originAction) => {
  assert(dmzModel.isModel(dmz))
  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  let { alias, spawnOpts } = originAction.payload
  const { network, validators, covenantId } = dmz
  let child = dmzModel.create({
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
  const channelUnused = !network[alias] || network[alias].address.isUnknown()
  if (!channelUnused) {
    throw new Error(`childAlias exists: ${alias}`)
  }
  // TODO insert dmz.getHash() into create() to generate repeatable randomness
  // TODO use chain key for signing
  const genesis = await effectInBand('SIGN_BLOCK', blockModel.create, child)
  assert(blockModel.isModel(genesis), `Genesis block creation failed`)
  const payload = { genesis, alias, originAction }
  const genesisRequest = actionModel.create('@@GENESIS', payload)
  const address = genesis.provenance.getAddress()

  const nextNetwork = {}
  // TODO override generate nonce to use some predictable seed, like last block
  let channel = channelModel.create(address, './')
  const childOriginProvenance = interblockModel.create(genesis)
  channel = channelProducer.ingestInterblock(channel, childOriginProvenance)
  channel = channelProducer.txRequest(channel, genesisRequest)
  if (network[alias]) {
    network[alias].getRequestIndices().forEach((index) => {
      const action = network[alias].requests[index]
      channel = channelProducer.txRequest(channel, action)
    })
  }
  nextNetwork[alias] = channel
  return networkModel.merge(network, nextNetwork)
}

module.exports = { spawn, spawnReducer, spawnReducerWithoutPromise }
