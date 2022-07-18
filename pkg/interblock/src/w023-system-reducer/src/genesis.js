import { interchain } from '../../w002-api'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('interblock:dmz:genesis')

/**
 * The first request that any new child chain sees.
 * This reponder initializes the reducer with the '@@INIT' action.
 * If the reducer does not throw, the child is born.
 * The payload appears untouched here, but it was used
 * by the system to generate the genesis block when it saw
 * the '@@GENESIS' request on the parents channel
 * @param {Request} request
 */
const genesisReducer = async (payload) => {
  assert(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 1)
  assert(payload.spawnOptions)
  // TODO check came from parent, and is first action
  const initResult = await interchain('@@INIT', payload)
  debug(`initResult`, initResult)
  let { spawnOptions = {}, installer = {} } = initResult
  spawnOptions = { ...payload.spawnOptions, ...spawnOptions }
  installer = { ...payload.installer, ...installer }
  const nextPayload = { spawnOptions, installer }
  const installResult = await interchain('@@INSTALL', nextPayload)
  debug('installResult', installResult)
}
export { genesisReducer }
