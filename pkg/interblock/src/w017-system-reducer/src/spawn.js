import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:dmz:spawn')

const spawn = (alias, spawnOpts = {}) => {
  const action = {
    type: '@@SPAWN',
    payload: { alias, spawnOpts },
  }
  if (!alias) {
    delete action.payload.alias
  }
  return action
}
const addChild = (alias, spawnOptions) => ({
  type: '@@ADD_CHILD',
  payload: { alias, spawnOptions },
})

const spawnReducer = async (request) => {
  const { type, payload } = request
  assert.strictEqual(type, '@@SPAWN')
  assert.strictEqual(typeof payload, 'object')

  let { alias = '', spawnOptions } = payload
  assert(typeof alias === 'string')
  // TODO check spawnOptions match a schema
  assert.strictEqual(typeof spawnOptions, 'object')
  assert.strictEqual(spawnOptions.validators, undefined, `no validators`)
  assert.strictEqual(spawnOptions.timestamp, undefined, `no timestamp`)

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?

  const addChildResult = await interchain(addChild(alias, spawnOptions))
  if (!alias) {
    alias = addChildResult.alias
  }
  assert.strictEqual(alias, addChildResult.alias)
  assert(alias, `alias error`)
  debug(`spawn alias:`, alias)

  const genesis = Request.create('@@GENESIS', { spawnOptions })
  await interchain(genesis, alias)
  return addChildResult
}

export { spawn, spawnReducer }
