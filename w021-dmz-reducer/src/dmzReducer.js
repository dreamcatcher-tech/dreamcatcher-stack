const assert = require('assert')
const debug = require('debug')('interblock:dmzReducer')
const _ = require('lodash')
const pad = require('pad/dist/pad.umd')
const {
  addressModel,
  stateModel,
  keypairModel,
  dmzModel,
  blockModel,
  interblockModel,
  channelModel,
  networkModel,
  rxRequestModel,
  rxReplyModel,
} = require('../../w015-models')
const { channelProducer } = require('../../w016-producers')
const {
  promise,
  resolve,
  request,
  isReplyFor,
  reject,
} = require('../../w002-api')
/**
 * DmzCommander is responsible for:
 *  1. multiplexing the covenant, if configured to do so
 *  2. altering the structure of the DMZ
 *  3. checking the ACL for all actions coming in
 *
 * It is modelled the same as a covenant reducer so that:
 *  1. the management logic is the same for covenants and system
 *  2. users interact with the dmz logic the same was as with other chains
 *  3. foreign chains can control the dmz logic easily
 *
 * These are all the commands that are possible to invoke remotely.
 *
 * @param {*} dmz
 * @param {*} action
 */

// TODO check the ACL each time ?

const reducer = async (dmz, action) => {
  debug(`reducer( ${action.type} )`)
  assert(dmzModel.isModel(dmz))
  const actions = []
  let { network } = dmz

  switch (action.type) {
    case '@@SPAWN':
      const { nextNetwork, genesisRequest } = await spawn(dmz, action)
      network = nextNetwork
      // TODO use await
      actions.push(genesisRequest)
      actions.push(promise())
      break
    case '@@CONNECT': // TODO WARNING uses same keyword as public connection initiation
      network = connectReducer(dmz.network, action)
      break
    case '@@GENESIS':
      // TODO check can only have come from parent, and must be the first action in the channel
      // auto respond will resolve this action
      break
    case '@@OPEN_CHILD':
      break
    case '@@INTRO':
      break
    case '@@ACCEPT':
      // just responding is enough to trigger lineage catchup
      break
    default:
      break
  }

  if (isReplyFor(action)) {
    const { request } = action
    switch (request.type) {
      case '@@GENESIS':
        const { genesis, alias, originAction } = request.payload
        assert(blockModel.isModel(genesis))
        const payload = { alias, chainId: genesis.getChainId() }
        const resolveAction = resolve(originAction, payload)
        debug('reply received for @@GENESIS')
        actions.push(resolveAction)
        break
    }
  }
  const result = { ...dmz, network, actions }
  return result
}

const rm = (id) => {
  // id either alias or address
  // if we are parent, kill the tree
}
const mv = () => {}

const actions = {}
const types = {
  spawn: '@@SPAWN',
  connect: '@@CONNECT',
  intro: '@@INTRO',
  accept: '@@ACCEPT',
  genesis: '@@GENESIS',
  open: '@@OPEN_CHILD',
}

actions.spawn = (alias, spawnOpts) => ({
  type: types.spawn,
  payload: { alias, spawnOpts },
})
const spawn = async (dmz, originAction) => {
  let genesis
  let { alias, spawnOpts } = originAction.payload
  const { network, validators } = dmz
  const child = dmzModel.create({ ...spawnOpts, validators })
  genesis = await blockModel.create(child) // TODO use chain key for signing

  const nextNetwork = networkModel.clone(network, (draft) => {
    // TODO override generate nonce to use some predictable seed, like last block
    debug(`spawn alias: ${alias}`)
    alias = !alias ? autoAlias(network) : alias
    assert(!network[alias], `childAlias exists: ${alias}`)

    const address = genesis.provenance.getAddress()
    let channel = channelModel.create(address, './')
    const childOriginProvenance = interblockModel.create(genesis)
    channel = channelProducer.ingestInterblock(channel, childOriginProvenance)
    draft[alias] = channel
  })
  assert(blockModel.isModel(genesis), `Genesis block creation failed`)
  const payload = { genesis, alias, originAction }
  const genesisRequest = request('@@GENESIS', payload, alias)
  return { nextNetwork, genesisRequest }
}

actions.connect = (alias, chainId) => ({
  type: types.connect,
  payload: { alias, chainId },
})
const connectReducer = (network, action) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    const address = addressModel.create(action.payload.chainId)
    assert.equal(address.getChainId(), action.payload.chainId)
    const { alias } = action.payload
    assert(alias && typeof alias === 'string')
    const channel = network[alias] || channelModel.create(address)
    // TODO blank the queues if changing address for existing alias ?
    // TODO beware unresolving an already resolved address
    draft[alias] = channelProducer.setAddress(channel, address)
  })

const isSystemRequest = (request) => {
  assert(rxRequestModel.isModel(request))
  const isSystemAction = request && Object.values(types).includes(request.type)
  debug(`isSystemAction: ${isSystemAction && request.type}`)
  return isSystemAction
}
const isSystemReply = (reply) => {
  assert(rxReplyModel.isModel(reply))
  const isSystemReply = reply && reply.request.type === '@@GENESIS'
  debug(`isSystemReply: ${isSystemReply && reply.type}`)
  return isSystemReply
}

const autoAlias = (network) => {
  const autoPrefix = 'file_'
  // TODO get highest current auto, and always return higher
  let highest = 0
  network.getAliases().forEach((alias) => {
    if (alias.startsWith(autoPrefix)) {
      try {
        const count = parseInt(alias.substring(autoPrefix.length))
        highest = count > highest ? count : highest
      } catch (e) {
        debug(`autoAlias error: `, e)
      }
    }
  })
  const filename = autoPrefix + pad(5, highest + 1, '0')
  return filename
}

module.exports = {
  actions,
  reducer,
  isSystemRequest,
  isSystemReply,
}
