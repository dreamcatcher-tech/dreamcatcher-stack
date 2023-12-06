import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Address, Pulse, Request, Reply } from '../../w008-ipld/index.mjs'
const debug = Debug('interblock:dmz:openPath')

export const openPath = async ({ path }) => {
  assert.strictEqual(typeof path, 'string')
  assert(path)
  debug(`openPath`, path)

  try {
    // TODO this should be done using API wrappers
    // something like useSystemApi() and useApi() hooks
    const getAddress = Request.create('@@GET_ADDRESS', { path })
    const { chainId } = await interchain(getAddress)
    const address = Address.fromChainId(chainId)
    debug(`address for`, path, address)

    await interchain('@@RESOLVE_DOWNLINK', { chainId, path })
  } catch (error) {
    debug('path invalid', path, error.message)
    await invalidate(path, error)
    throw error
  }
  return
}
const invalidate = async (path, error) => {
  const rejection = Reply.createError(error)
  const errorSerialized = rejection.payload
  await interchain('@@INVALIDATE', { path, errorSerialized })
}

export const openChild = async ({ child, chainId }) => {
  assert.strictEqual(typeof child, 'string')
  assert(child)
  const address = Address.fromChainId(chainId)
  assert(address.isRemote())
  debug(`openChild %s to %o`, child, address)
  return await interchain('@@CONNECT', { chainId }, child)
}
