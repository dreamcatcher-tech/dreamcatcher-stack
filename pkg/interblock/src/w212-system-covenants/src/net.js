import { multiaddr as fromString } from '@multiformats/multiaddr'
import assert from 'assert-fast'
import { peerIdFromString } from '@libp2p/peer-id'
import { interchain, useState, isSystemAction } from '../../w002-api'
import { Address, Request } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interblock:system:net')

const reducer = async (request) => {
  const { type, payload } = request
  debug('request:', type)
  if (isSystemAction(request)) {
    return
  }
  switch (type) {
    case '@@INIT': {
      return
    }
    case 'MOUNT': {
      const { chainId, name } = payload
      debug('mount', name, chainId.substr(0, 14))
      const hardlink = Request.createHardlink(name, chainId)
      return await interchain(hardlink)
    }
    case 'PEER': {
      const { peerId, chainId } = payload
      assert(peerIdFromString(peerId))
      assert(Address.fromChainId(chainId))
      let [state, setState] = await useState()
      state = ensureChainId(state, peerId, chainId)
      return await setState(state)
    }
    case 'MULTIADDR': {
      const { multiaddr } = payload
      let [state, setState] = await useState()
      const addr = fromString(multiaddr)
      const peerId = addr.getPeerId()
      assert(peerIdFromString(peerId))
      state = ensureMultiAddr(state, peerId, multiaddr)
      return await setState(state)
    }
    default: {
      throw new Error('Unknown action:' + type)
    }
  }
}
const ensureMultiAddr = (state, peerId, addr) => {
  state = ensurePeerId(state, peerId)
  let record = state[peerId]
  if (!record.multiaddrs.includes(addr)) {
    record = { ...record, multiaddrs: [...record.multiaddrs, addr] }
    state = { ...state, [peerId]: record }
  }
  return state
}
const ensurePeerId = (state, peerId) => {
  if (!state[peerId]) {
    state = {
      ...state,
      [peerId]: { multiaddrs: [], chainIds: [] },
    }
  }
  return state
}
const ensureChainId = (state, peerId, chainId) => {
  state = ensurePeerId(state, peerId)
  let record = state[peerId]
  if (!record.chainIds.includes(chainId)) {
    record = { ...record, chainIds: [...record.chainIds, chainId] }
    state = { ...state, [peerId]: record }
  }
  return state
}
const api = {
  multiaddr: {
    type: 'object',
    title: 'MULTIADDR',
    description: `Add a new multiaddr to network memory`,
    required: ['multiaddr'],
    properties: {
      // TODO regex that requires pubkey and valid multiaddr
      multiaddr: { type: 'string' },
    },
  },
  peer: {
    type: 'object',
    title: 'PEER',
    description: `Add a new multiaddr to network memory`,
    required: ['chainId', 'peerId'],
    properties: {
      // TODO regex
      chainId: { type: 'string' },
      peerId: { type: 'string' },
    },
  },
  mount: {
    type: 'object',
    title: 'MOUNT',
    description: `Attempt to mount the given chainId at the given mountPath.
      This will make an entry in mtab if there is not one already.`,
    additionalProperties: false,
    required: ['name', 'chainId'],
    properties: {
      name: { type: 'string' }, // TODO regex to have no path elements
      chainId: { type: 'string', pattern: 'Qm[1-9A-Za-z]{44}' },
      noSkip: {
        type: 'boolean',
        description: `When fetching updates for the remote, ensure every pulse in the lineage is fetched, as opposed to lazily fetching only the latest known`,
      },
    },
  },
}
const name = 'net'
export { name, api, reducer }
