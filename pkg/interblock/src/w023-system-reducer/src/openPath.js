import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Address, Pulse, Request } from '../../w008-ipld'
const debug = Debug('interblock:dmz:openPath')

export const openPath = async ({ path }) => {
  assert.strictEqual(typeof path, 'string')
  assert(path)
  debug(`openPath`, path)

  try {
    // TODO resolve relative paths
    await interchain(Request.tryPath('/' + path))
  } catch (error) {
    debug('path invalid', path)
    await invalidate(path)
    throw error
  }

  let count = 0
  let deepest
  while (count++ < 10 && deepest !== path) {
    const { segment } = await interchain('@@DEEPEST_SEGMENT', { path })
    deepest = segment
    if (deepest !== path) {
      const child = getNextSegment(deepest, path)
      debug(`next child of %s is %s`, deepest, child)
      const { chainId } = await interchain('@@SELF_ID')
      const payload = { child, chainId }
      try {
        const result = await interchain('@@OPEN_CHILD', payload, deepest)
        const { childChainId } = result
        const childAddress = Address.fromChainId(childChainId)
        assert(childAddress.isRemote())
        const path = deepest + '/' + child
        await interchain('@@RESOLVE_DOWNLINK', { chainId: childChainId, path })
        debug(`opened`, child, childAddress)
      } catch (error) {
        return await invalidate(path)
      }
    }
  }
}
const invalidate = async (path) => {
  await interchain('@@INVALIDATE', { path })
}

export const deepestSegment = async (pulse, { path }) => {
  assert(pulse instanceof Pulse)
  assert.strictEqual(typeof path, 'string')
  assert(path)
  debug(`deepestSegment of:`, path)
  const segments = getReversePathSegments(path)
  debug(`segments`, segments)
  const network = pulse.getNetwork()
  for (const segment of segments) {
    if (await network.hasChannel(segment)) {
      const channel = await network.getChannel(segment)
      if (channel.address.isResolved()) {
        debug(`deepestSegment is:`, segment)
        return { segment }
      }
    }
  }
}

export const openChild = async ({ child, chainId }) => {
  assert.strictEqual(typeof child, 'string')
  assert(child)
  const address = Address.fromChainId(chainId)
  assert(address.isRemote())
  debug(`openChild %s to %o`, child, address)
  return await interchain('@@CONNECT', { chainId }, child)
}

const getNextSegment = (deepest, path) => {
  assert(path.startsWith(deepest))
  assert(path !== deepest)
  const tail = path.substring(deepest.length + '/'.length)
  const segments = getReversePathSegments(tail)
  assert(segments.length)
  return segments.pop()
}

const getReversePathSegments = (path) => {
  let prefix = ''
  const paths = path.split('/').map((segment) => {
    prefix && (prefix += '/') // TODO make child naming convention avoid this check ?
    prefix += segment
    return prefix
  })
  paths.reverse()
  return paths
}
