const assert = require('assert')
const debug = require('debug')('interblock:dmzReducer')
const _ = require('lodash')
const pad = require('pad/dist/pad.umd')
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

const reducer = async (dmz, action) => {
  debug(`reducer( ${action.type} )`)
  assert(dmzModel.isModel(dmz))
  assert(rxReplyModel.isModel(action) || rxRequestModel.isModel(action))
  let { network } = dmz

  switch (action.type) {
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
      const { nextNetwork, payload } = connectUplinkReducer(dmz.network, action)
      replyResolve(payload)
      network = nextNetwork
      break
    }
    case '@@GENESIS': {
      // TODO check can only have come from parent, and must be the first action in the channel
      // auto respond will resolve this action
      break
    }
    case '@@OPEN_CHILD': {
      openChildReducer(dmz.network, action)
      break
    }
    case '@@LIST_CHILDREN': {
      const payload = listChildrenReducer(dmz.network)
      replyResolve(payload)
      break
    }
    case '@@GET_GIVEN_NAME': {
      const payload = getGivenNameReducer(dmz.network)
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
        const { alias } = request.payload.originAction.payload
        debug('reply received for @@UPLINK: %o', alias)
        const chainId = network[alias].address.getChainId()
        const payload = { chainId }
        replyResolve(payload, request.payload.originAction)
        break
      }
      case '@@OPEN_CHILD': {
        const { chainId } = action.payload
        debug(`reply received for @@OPEN_CHILD: %o`, chainId.substring(0, 9))
        const { fullPath } = request.payload
        interchain(dmzActions.connect(fullPath, chainId))
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

const dmzActions = {}
const types = {
  spawn: '@@SPAWN',
  genesis: '@@GENESIS',
  connect: '@@CONNECT',
  uplink: '@@UPLINK',
  intro: '@@INTRO',
  accept: '@@ACCEPT',
  openChild: '@@OPEN_CHILD',
  listChildren: '@@LIST_CHILDREN',
  getGivenName: '@@GET_GIVEN_NAME',
  deploy: '@@DEPLOY',
  install: '@@INSTALL',
}

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
  const channelUnused = !network[alias] || network[alias].address.isUnknown()
  assert(channelUnused, `childAlias exists: ${alias}`)
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

dmzActions.connect = (alias, chainId) => ({
  type: types.connect,
  payload: { alias, chainId },
})
const connectReducer = (network, action) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    const address = addressModel.create(action.payload.chainId)
    assert(address.isResolved())
    assert.strictEqual(address.getChainId(), action.payload.chainId)
    const { alias } = action.payload
    assert(alias && typeof alias === 'string')
    const channel = network[alias] || channelModel.create(address)
    // TODO blank the queues if changing address for existing alias ?
    // TODO beware unresolving an already resolved address
    draft[alias] = channelProducer.setAddress(channel, address)
  })

dmzActions.connectUplink = (chainId, originAction) => ({
  type: types.uplink,
  payload: { chainId, originAction }, // TODO replace with generic promise hook
})
const connectUplinkReducer = (network, action) => {
  let alias
  const nextNetwork = networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    const address = addressModel.create(action.payload.chainId)
    assert.strictEqual(address.getChainId(), action.payload.chainId)
    assert(address.isResolved())

    const existing = network.getAlias(address)
    assert(!existing || network[existing].systemRole !== 'UP_LINK')

    alias = autoAlias(network, '.uplink_')
    assert(!network[alias])

    draft[alias] = channelModel.create(address)
    const short = action.payload.chainId.substring(0, 9)
    debug(`connectUplinkReducer ${alias} set to ${short}`)
  })
  assert(alias)
  const payload = { alias }
  return { nextNetwork, payload }
}
dmzActions.openChild = (alias, fullPath) => ({
  type: types.openChild,
  payload: { alias, fullPath },
})
const openChildReducer = (network, action) => {
  assert(rxRequestModel.isModel(action))

  const { alias } = action.payload
  const channel = network[alias]
  if (!channel) {
    replyReject(`Alias not found: ${alias}`)
  } else if (channel.systemRole !== './') {
    replyReject(`Alias found, but is not child: ${alias}`)
  } else {
    const chainId = action.getAddress().getChainId()
    // TODO dispatch thru actions, rather than direct insertion
    const { type, payload } = dmzActions.connectUplink(chainId, action)
    interchain(type, payload, alias)
    // TODO who handles ACL for opening child ?
    replyPromise()
  }
}
dmzActions.listChildren = () => ({ type: types.listChildren })
const listChildrenReducer = (network) => {
  debug(`listChildrenReducer`)
  return { children: network.getAliases() }
}

dmzActions.getGivenName = () => ({ type: types.getGivenName })
const getGivenNameReducer = (network) => {
  debug(`getGivenNameReducer`)
  const parent = network['..']
  let givenName
  if (parent.address.isRoot()) {
    assert(!parent.heavy)
    givenName = '/'
  } else {
    assert(parent.heavy)
    givenName = parent.heavy.getOriginAlias()
  }
  assert(givenName)
  return { givenName }
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

const autoAlias = (network, autoPrefix = 'file_') => {
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
  return autoPrefix + pad(5, highest + 1, '0')
}
const openPaths = (network) =>
  // TODO move to being a loopback action at the end of interpreter
  // in dmzReducer because it needs to communicate with the dmz reducers
  networkModel.clone(network, (draft) => {
    // unresolved paths can only come from requests
    assert(networkModel.isModel(network))
    const aliases = network.getAliases()
    const unresolved = aliases.filter((alias) =>
      network[alias].address.isUnknown()
    )
    unresolved.forEach((alias) => {
      if (alias === '.@@io') {
        return
      }
      const paths = _getPathSegments(alias)
      paths.forEach((path, index) => {
        const channel = network[path]
        if (channel && !channel.address.isUnknown()) {
          return
        }
        if (!channel) {
          // TODO if we have a subpath, but no parents - we should shortcut that
          // if the parent is awaiting open, then bail
        }
        debug(`unresolved path: `, path)

        if (index === 0) {
          // TODO handle immediate child being unresolved ?
          debug(`immediate child unresolved`)
        }

        const parent = paths[index - 1]
        debug('parent: ', parent)
        const child = path.substring(parent.length + 1)
        debug('child: ', child)
        if (_isAwaitingOpen(network[parent])) {
          debug(`parent: %o was already asked to open child: %o`, parent, child)
          return
        }
        const open = actionModel.create(dmzActions.openChild(child, path))
        debug(`open: `, open)

        draft[parent] = channelProducer.txRequest(network[parent], open)
      })
    })
  })
const _isAwaitingOpen = (channel) => {
  const pairs = channel.getOutboundPairs()
  return pairs.some(([req, rep]) => {
    const isUnresolved = !rep || rep.isPromise()
    return req.type === '@@OPEN_CHILD' && isUnresolved
  })
}
const _getPathSegments = (path) => {
  // TODO handle escaped backsmash
  let prefix = ''
  const paths = path.split('/').map((segment) => {
    prefix && (prefix += '/') // TODO make child naming convention avoid this check ?
    prefix += segment
    return prefix
  })
  return paths
}

module.exports = {
  actions: dmzActions,
  reducer,
  isSystemRequest,
  isSystemReply,
  openPaths,
}
