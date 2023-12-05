import assert from 'assert-fast'
import pad from 'pad-left'
import { Channel, Network, Pulse } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interblock:dmz:utils')

const autoAlias = async (network, autoPrefix = '') => {
  assert(network instanceof Network)
  assert.strictEqual(typeof autoPrefix, 'string')
  let height = 0
  let alias
  do {
    alias = autoPrefix ? autoPrefix + pad(height, 5, '0') : height + ''
    height++
  } while (await network.hasChannel(alias))
  return alias
}
const getChannelParams = (channel) => {
  assert(channel instanceof Channel, `Not channel`)
  const { address, rx, tx } = channel
  const chainId = address.isResolved()
    ? address.getChainId()
    : address.toString()
  const params = { chainId }
  if (rx.tip) {
    params.tip = rx.tip.toString()
  }
  if (tx.precedent) {
    params.precedent = tx.precedent.toString()
  }
  return params
}
const listChildren = async (pulse, all = false) => {
  assert(pulse instanceof Pulse)
  assert(typeof all === 'boolean')
  const children = {}
  const childrenHamt = pulse.getNetwork().children
  // TODO assign aliases to each channel, grouped by type
  // then listChildren just accumulates all those entries
  for await (const [alias, channelId] of childrenHamt.entries()) {
    const channel = await pulse.getNetwork().channels.getChannel(channelId)
    if (!all && alias.startsWith('.')) {
      continue
    }
    children[alias] = getChannelParams(channel)
  }
  const parent = await pulse.getNetwork().getParent()
  children['..'] = getChannelParams(parent)
  const self = {}
  children['.'] = self
  self.chainId = pulse.getAddress().getChainId()
  self.hash = pulse.getPulseLink().cid.toString()
  if (parent.address.isRoot()) {
    self.alias = '/'
  }
  if (pulse.provenance.dmz.config.isPierced) {
    const io = await pulse.getNetwork().getIo()
    children['.@@io'] = getChannelParams(io)
  }
  return children
}
const listHardlinks = async (pulse, all = false) => {
  assert(pulse instanceof Pulse)
  assert(typeof all === 'boolean')
  const hardlinks = {}
  const hardlinksHamt = pulse.getNetwork().hardlinks
  for await (const [alias, channelId] of hardlinksHamt.entries()) {
    if (!all && alias.startsWith('.')) {
      continue
    }
    const channel = await pulse.getNetwork().channels.getChannel(channelId)
    hardlinks[alias] = getChannelParams(channel)
  }
  return hardlinks
}
export { autoAlias, getChannelParams, listChildren, listHardlinks }
