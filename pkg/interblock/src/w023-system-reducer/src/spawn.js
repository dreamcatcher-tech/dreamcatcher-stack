import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:dmz:spawn')

const spawnReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')

  let { alias = '', installer } = payload
  assert(typeof alias === 'string')
  // TODO check installer matches covenant schema
  assert.strictEqual(typeof installer, 'object')
  assert.strictEqual(installer.validators, undefined, `no validators`)
  assert.strictEqual(installer.timestamp, undefined, `no timestamp`)

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?

  const addChild = Request.createAddChild(alias, installer)
  const addChildResult = await interchain(addChild)
  if (!alias) {
    alias = addChildResult.alias
  }
  assert.strictEqual(alias, addChildResult.alias)
  assert(alias, `alias error`)
  const { chainId, entropy } = addChildResult
  debug(`spawn alias:`, alias, entropy)

  installer = injectEntropy(installer, entropy)
  const genesis = Request.create('@@GENESIS', { installer })
  await interchain(genesis, alias)
  return { alias, chainId }
}
const injectEntropy = (installer, entropy) => {
  let { config = {} } = installer
  config = { ...config, entropy }
  installer = { ...installer, config }
  return installer
}
export { spawnReducer }
