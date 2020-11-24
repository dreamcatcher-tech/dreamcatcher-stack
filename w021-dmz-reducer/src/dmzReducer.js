const assert = require('assert')
const debug = require('debug')('interblock:dmzReducer')
const _ = require('lodash')
const pad = require('pad/dist/pad.umd')
const {
  actionModel,
  addressModel,
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
      const { nextNetwork, genesisRequest } = await spawn(dmz, action)
      network = nextNetwork
      interchain(genesisRequest)
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
        replyResolve(payload, originAction)
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
  connect: '@@CONNECT',
  uplink: '@@UPLINK',
  intro: '@@INTRO',
  accept: '@@ACCEPT',
  genesis: '@@GENESIS',
  openChild: '@@OPEN_CHILD',
  listChildren: '@@LIST_CHILDREN',
  getGivenName: '@@GET_GIVEN_NAME',
}

dmzActions.spawn = (alias, spawnOpts = {}) => ({
  type: types.spawn,
  payload: { alias, spawnOpts },
})
const spawn = async (dmz, originAction) => {
  let genesis
  let { alias, spawnOpts } = originAction.payload
  const { network, validators } = dmz
  const child = dmzModel.create({ ...spawnOpts, validators })
  genesis = await effectInBand('SIGN_BLOCK', blockModel.create, child) // TODO use chain key for signing

  const nextNetwork = networkModel.clone(network, (draft) => {
    // TODO override generate nonce to use some predictable seed, like last block
    debug(`spawn alias: ${alias}`)
    alias = !alias ? autoAlias(network) : alias
    assert(!alias.includes('/'), `No / character allowed in "${alias}"`)
    assert(!network[alias], `childAlias exists: ${alias}`)

    const address = genesis.provenance.getAddress()
    let channel = channelModel.create(address, './')
    const childOriginProvenance = interblockModel.create(genesis)
    channel = channelProducer.ingestInterblock(channel, childOriginProvenance)
    draft[alias] = channel
  })
  assert(blockModel.isModel(genesis), `Genesis block creation failed`)
  const payload = { genesis, alias, originAction }
  const genesisRequest = { type: '@@GENESIS', payload, to: alias }
  return { nextNetwork, genesisRequest }
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

const isSystemRequest = (request) => {
  if (!rxRequestModel.isModel(request)) {
    return false
  }
  const isSystemAction = Object.values(types).includes(request.type)
  debug(`isSystemAction: ${isSystemAction} type: ${request.type}`)
  return isSystemAction
}

const systemReplyTypes = [types.genesis, types.uplink, types.openChild]
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
