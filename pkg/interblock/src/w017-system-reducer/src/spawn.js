import assert from 'assert-fast'
import Debug from 'debug'
import { interchain } from '../../w002-api'
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
  assert.strictEqual(typeof spawnOptions, 'object')
  assert.strictEqual(spawnOptions.validators, undefined, `no validators`)
  assert.strictEqual(spawnOptions.timestamp, undefined, `no timestamp`)

  // TODO reject if spawn requested while deploy is unresolved
  // may reject any actions other than cancel deploy while deploying ?
  // TODO check spawnOptions match a schema

  const result = await interchain(addChild(alias, spawnOptions))
  if (!alias) {
    alias = result.alias
  }
  assert.strictEqual(alias, result.alias)
  assert(alias, `alias error`)
  debug(`spawn alias:`, alias)
  await interchain('@@PING', {}, alias)
  return result
}

export { spawn, spawnReducer }
