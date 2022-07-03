import { interchain } from '../../w002-api'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('interblock:dmz:genesis')

/**
 * The first request that any new child chain sees.
 * This reponder initializes the reducer with the '@@INIT' action.
 * If the reducer does not throw, the child is born.
 * @param {Request} request
 */
const genesisReducer = async (request) => {
  const { type } = request
  assert.strictEqual(type, '@@GENESIS')
  // TODO check can only have come from parent, and must be the first action in the channel
  const initResult = await interchain('@@INIT')
  debug(`initResult`, initResult)
}
export { genesisReducer }
