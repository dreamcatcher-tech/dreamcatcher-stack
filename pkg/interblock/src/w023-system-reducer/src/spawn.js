import assert from 'assert-fast'
import Debug from 'debug'
import { interchain, useState } from '../../w002-api'
import { Dmz, Request } from '../../w008-ipld/index.mjs'
import merge from 'lodash.merge'
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

  // BUT want to lookup the covenant based on the root covenant
  // this should be deferred until as late as possible
  // if (installer.covenant?.startsWith('#')) {
  // const covenant = installer.covenant.slice('#'.length)
  // debug(`covenant path`, covenant)
  // installer = { ...installer, covenant }
  // }
  if (installer.covenant) {
    const path = Dmz.convertToCovenantPath(installer.covenant)
    const [state] = await useState(path)
    if (state.installer) {
      installer = merge({}, state.installer, installer)
    }
  }

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
