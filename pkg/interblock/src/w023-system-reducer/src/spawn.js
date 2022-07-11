import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:dmz:spawn')

const spawnReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')

  let { alias = '', spawnOptions } = payload
  assert(typeof alias === 'string')
  // TODO check spawnOptions match a schema
  assert.strictEqual(typeof spawnOptions, 'object')
  assert.strictEqual(spawnOptions.validators, undefined, `no validators`)
  assert.strictEqual(spawnOptions.timestamp, undefined, `no timestamp`)

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?

  const addChild = Request.createAddChild(alias, spawnOptions)
  const addChildResult = await interchain(addChild)
  if (!alias) {
    alias = addChildResult.alias
  }
  assert.strictEqual(alias, addChildResult.alias)
  assert(alias, `alias error`)
  const { chainId, entropy } = addChildResult
  debug(`spawn alias:`, alias, entropy)

  spawnOptions = injectEntropy(spawnOptions, entropy)
  const genesis = Request.create('@@GENESIS', { spawnOptions })
  await interchain(genesis, alias)
  return { alias, chainId }
}
const injectEntropy = (spawnOptions, entropy) => {
  let { config = {} } = spawnOptions
  config = { ...config, entropy }
  spawnOptions = { ...spawnOptions, config }
  return spawnOptions
}
export { spawnReducer }
