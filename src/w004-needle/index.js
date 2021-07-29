/**
 * Allows dropping the needle into any place in the code, and making context
 * aware decisions, to run custom code like debug breakpoints.
 * Without this, getting the system to the needed state and stepping in to
 * the desired point in the engine code can be impractical.
 */ 
import assert from 'assert'
import Debug from 'debug'
const debug = Debug('ib:needle')
let _tap

  export const test = (network, alias, height, fn) => {
    assert(_tap, `tap not set`)
    // if network belongs to this alias, and is at this height, run this fn
    const block = _tap.getLatest(alias)
    const blockParent = block.network['..'].address
    const isParentSame = network['..'].address.equals(blockParent)
    const isAliasSame = compareAliases(block.network['..'], network['..'])
    const isHeightSame = height === block.provenance.height
    if (isParentSame && isAliasSame && isHeightSame) {
      fn(debug)
    }
  }
  export const setTap = (tap) => {
    _tap = tap
  }
  export const printNetwork= (network, msg) => {
    const text = _tap.printNetwork(network, msg)
    debug(text)
  }
 export const print = (...args) => debug(...args),


const compareAliases = (channelA, channelB) => {
  if (channelA.address.isRoot() && channelB.address.isRoot()) {
    return true
  }
  if (!channelA.heavy || !channelB.heavy) {
    return false
  }
  const aliasA = channelA.heavy.getOriginAlias()
  const aliasB = channelB.heavy.getOriginAlias()
  return aliasA === aliasB
}
