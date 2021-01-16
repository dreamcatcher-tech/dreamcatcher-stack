const assert = require('assert')
const debug = require('debug')('interblock:dmz')
const _ = require('lodash')
const posix = require('path')
const { openChildReducer, openChildReply, openPaths } = require('./openChild')
const { uplinkReducer, uplinkReply } = require('./uplink')
const { connect, connectReducer } = require('./connect')
const { ping, pingReducer } = require('./ping')
const { autoAlias } = require('./utils.js')
const {
  actionModel,
  addressModel,
  covenantIdModel,
  dmzModel,
  blockModel,
  interblockModel,
  channelModel,
  networkModel,
  txRequestModel,
  rxRequestModel,
  rxReplyModel,
} = require('../../w015-models')
const { networkProducer, channelProducer } = require('../../w016-producers')
const {
  replyPromise,
  replyResolve,
  replyReject,
  isReplyFor,
  effectInBand,
  interchain,
} = require('../../w002-api')
/**
 * DmzReducer is responsible for:
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
 * Whilst transmissions could be entered directly into the dmz in this
 * reducer, using the api methods for sending allows greater debug ability.
 *
 * @param {*} dmz
 * @param {*} action
 */

// TODO check the ACL each time ?

const dmzActions = { ping, connect }
const types = {
  ping: '@@PING',
  spawn: '@@SPAWN',
  genesis: '@@GENESIS',
  connect: '@@CONNECT',
  uplink: '@@UPLINK',
  intro: '@@INTRO',
  accept: '@@ACCEPT',
  openChild: '@@OPEN_CHILD',
  listChildren: '@@LS',
  getGivenName: '@@GET_GIVEN_NAME',
  deploy: '@@DEPLOY',
  install: '@@INSTALL',
  getChannel: '@@GET_CHAN',
}
const reducer = async (dmz, action) => {
  debug(`reducer( ${action.type} )`)
  assert(dmzModel.isModel(dmz))
  assert(rxReplyModel.isModel(action) || rxRequestModel.isModel(action))
  let { network } = dmz

  switch (action.type) {
    case '@@PING': {
      pingReducer(action)
      break
    }
    case '@@SPAWN': {
      const nextNetwork = await spawnReducer(dmz, action)
      network = nextNetwork
      replyPromise()
      break
    }
    case '@@CONNECT': {
      network = connectReducer(dmz.network, action)
      break
    }
    case '@@UPLINK': {
      network = uplinkReducer(dmz.network, action)
      break
    }
    case '@@GENESIS': {
      // TODO check can only have come from parent, and must be the first action in the channel
      // auto respond will resolve this action
      break
    }
    case types.openChild: {
      openChildReducer(dmz.network, action)
      break
    }
    case '@@LS': {
      const payload = listChildrenReducer(dmz.network)
      replyResolve(payload)
      break
    }
    case '@@INTRO': {
      break
    }
    case '@@ACCEPT': {
      // just default responding is enough to trigger lineage catchup
      break
    }
    case '@@INSTALL':
    case '@@DEPLOY': {
      // TODO clean up failed partial deployments ?
      network = await deployReducer(dmz, action)
      break
    }
    case types.getChannel: {
      getChannelReducer(dmz.network, action)
      break
    }
    default: {
      break
    }
  }

  if (isReplyFor(action)) {
    const request = action.getRequest()
    switch (request.type) {
      case '@@GENESIS': {
        // TODO lighten size of actions by storing origin in state ?
        const { genesis, alias, originAction } = request.payload
        const genesisModel = blockModel.clone(genesis)
        const payload = { alias, chainId: genesisModel.getChainId() }
        if (originAction.sequence) {
          replyResolve(payload, originAction)
        }
        debug('reply received for @@GENESIS')
        break
      }
      case '@@UPLINK': {
        uplinkReply(dmz.network, action)
        break
      }
      case types.openChild: {
        network = openChildReply(dmz.network, action)
        break
      }
      case '@@DEPLOY': {
        debug(`reply received for deploy`, action)
        deployReply(dmz, action)
        break
      }
    }
  }
  const result = { ...dmz, network }
  return result
}

const rm = (id) => {
  // id either alias or address
  // if we are parent, kill the tree
}
const mv = () => {}

dmzActions.spawn = (alias, spawnOpts = {}, actions = []) => {
  const action = {
    type: types.spawn,
    payload: { alias, spawnOpts, actions },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}
const spawnReducer = async (dmz, spawnRequest) => {
  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  let { alias, spawnOpts, actions } = spawnRequest.payload
  if (!Array.isArray(actions)) {
    actions = [actions]
  }
  actions = actions.map(({ type, payload, to }) =>
    txRequestModel.create(type, payload, to)
  )
  const { network, validators, covenantId } = dmz
  const childNet = networkProducer.tx(networkModel.create(), actions, [])
  let child = dmzModel.create({
    network: childNet,
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
  const payload = { genesis, alias, originAction: spawnRequest }
  const genesisRequest = actionModel.create('@@GENESIS', payload)
  const address = genesis.provenance.getAddress()

  const nextNetwork = networkModel.clone(network, (draft) => {
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
    draft[alias] = channel
  })
  return nextNetwork
}

dmzActions.listChildren = () => ({ type: types.listChildren })
const listChildrenReducer = (network) => {
  debug(`listChildrenReducer`)
  const children = {}
  const aliases = network.getAliases().filter((alias) => alias !== '.')
  aliases.forEach((alias) => {
    children[alias] = _getChannelParams(network, alias)
  })
  return { children }
}
const _getChannelParams = (network, alias) => {
  const channel = network[alias]
  assert(channelModel.isModel(channel))
  const { address, systemRole, lineageHeight, heavyHeight, heavy } = channel
  let chainId = address.isResolved() ? address.getChainId() : 'UNRESOLVED'
  chainId = address.isRoot() ? 'ROOT' : chainId
  const params = {
    systemRole,
    chainId,
    lineageHeight,
    heavyHeight,
  }
  if (heavy) {
    params.hash = heavy.provenance.reflectIntegrity().hash
    remoteName = heavy.getOriginAlias()
    remoteName && (params.remoteName = remoteName)
  }
  return params
}

dmzActions.getChannel = (alias = '.') => ({
  type: types.getChannel,
  payload: { alias },
})
const getChannelReducer = (network, action) => {
  let { alias } = action.payload
  assert.strictEqual(typeof alias, 'string')
  alias = posix.normalize(alias)
  debug(`getChannelReducer`, alias)
  if (network['..'].address.isRoot() && alias.startsWith('/')) {
    alias = alias.substring(1)
    alias = alias || '.'
  }
  if (!network[alias]) {
    throw new Error(`Unknown channel: ${alias}`)
  }
  replyResolve(_getChannelParams(network, alias))
}

dmzActions.install = (installer) => ({
  type: types.install,
  payload: { installer },
})
dmzActions.deploy = (installer) => ({
  type: types.deploy,
  payload: { installer },
})
const deployReducer = async (dmz, action) => {
  const { installer } = action.payload
  // TODO assert there is only one deployment action, from parent, and after genesis
  // TODO check format of payload against schema
  // TODO check top level matches this current state
  const { children: topChildren = {} } = installer
  // TODO try make promises that work on a specific action, so can run in parallel
  for (const installPath in topChildren) {
    let { children, covenant, ...spawnOptions } = topChildren[installPath]
    covenant = covenant || 'unity'
    const covenantId = covenantIdModel.create(covenant)
    spawnOptions = { ...spawnOptions, covenantId }
    const genesisSeed = 'seed_' + installPath
    const { spawn } = dmzActions
    const spawnRequest = spawn(installPath, spawnOptions, [], genesisSeed)
    const network = await spawnReducer(dmz, spawnRequest)
    // TODO make spawn not require dmz to be cloned like this
    dmz = dmzModel.clone({ ...dmz, network })
    const deployAction = dmzActions.deploy(topChildren[installPath])
    interchain(deployAction, installPath)
  }
  if (Object.keys(topChildren).length) {
    replyPromise() // else, default resolve will end the deploy
  }
  return dmz.network
}
const deployReply = (dmz, reply) => {
  // TODO handle rejection of deployment
  assert(rxReplyModel.isModel(reply))

  const aliases = dmz.network.getResolvedAliases()
  let outstandingDeploy
  for (const alias of aliases) {
    const channel = dmz.network[alias]
    if (channel.systemRole !== './') {
      continue // TODO block all activity until deploy completes
    }
    const deployRequest = channel.requests[1]
    if (!deployRequest || deployRequest.type !== types.deploy) {
      continue // deployment must have completed
    }
    if (outstandingDeploy) {
      return
    }
    outstandingDeploy = deployRequest
  }
  const isReplyValid = isReplyFor(reply, outstandingDeploy)
  assert(isReplyValid, `action was not round among any deploy replies`)

  const parent = dmz.network['..']
  // TODO compare against installer
  // TODO assert only one deploy in the queue
  for (const index of parent.getRemoteRequestIndices()) {
    const request = parent.rxRequest(index)
    if (request.type === types.deploy) {
      replyResolve({}, request)
    }
    if (request.type === types.install) {
      replyResolve({}, request)
    }
  }
}

const isSystemRequest = (request) => {
  if (!rxRequestModel.isModel(request)) {
    return false
  }
  const isSystemAction = Object.values(types).includes(request.type)
  debug(`isSystemAction: ${isSystemAction} type: ${request.type}`)
  return isSystemAction
}

const systemReplyTypes = [
  types.genesis,
  types.uplink,
  types.openChild,
  types.deploy,
]
const isSystemReply = (reply) => {
  // is this action solely originating from dmzReducer, or might it have come from user
  if (!rxReplyModel.isModel(reply)) {
    return false
  }
  const request = reply.getRequest()
  const isSystemReply = systemReplyTypes.includes(request.type)
  debug(`isSystemReply: ${isSystemReply} type: ${request.type}`)
  return isSystemReply
}

module.exports = {
  actions: dmzActions,
  reducer,
  isSystemRequest,
  isSystemReply,
  openPaths,
}
