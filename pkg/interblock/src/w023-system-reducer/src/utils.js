import assert from 'assert-fast'
import pad from 'pad-left'
import { Channel, Network, Pulse } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:dmz:utils')

const autoAlias = async (network, autoPrefix = 'file_') => {
  assert(network instanceof Network)
  assert.strictEqual(typeof autoPrefix, 'string')
  let height = 0
  let alias
  do {
    height++
    alias = autoPrefix + pad(height, 5, '0')
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
const listChildren = async (pulse) => {
  assert(pulse instanceof Pulse)
  const children = {}
  const childrenHamt = pulse.getNetwork().children
  // TODO assign aliases to each channel, grouped by type
  // then listChildren just accumulates all those entries
  for await (const [alias, channelId] of childrenHamt.entries()) {
    const channel = await pulse.getNetwork().channels.getChannel(channelId)
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
const listHardlinks = async (pulse) => {
  assert(pulse instanceof Pulse)
  const hardlinks = {}
  const hardlinksHamt = pulse.getNetwork().hardlinks
  const entries = hardlinksHamt.entries()
  for await (const [alias, channelId] of hardlinksHamt.entries()) {
    const channel = await pulse.getNetwork().channels.getChannel(channelId)
    hardlinks[alias] = getChannelParams(channel)
  }
  return hardlinks
}
export { autoAlias, getChannelParams, listChildren, listHardlinks }
