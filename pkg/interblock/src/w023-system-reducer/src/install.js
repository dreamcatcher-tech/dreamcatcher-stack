import assert from 'assert-fast'
import { Request, Pulse } from '../../w008-ipld'
import { useState, interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 2)
  debug(payload)
  const covenantState = await interchain(Request.createGetCovenantState())
  const { network = {}, state = {} } = covenantState
  assert.strictEqual(typeof network, 'object')
  assert.strictEqual(typeof state, 'object')

  // TODO clean up failed partial deployments ?
  // TODO accomodate existing children already ? or throw ?
  if (Object.keys(state).length) {
    const [currentState, setState] = await useState()
    assert.strictEqual(Object.keys(currentState).length, 0)
    await setState(state)
  }
  const awaits = []
  for (const child in network) {
    debug('installing child: ', child)
    const { network, ...rest } = network[child]
    const spawnOptions = mapInstaller(rest)
    const spawn = Request.createSpawn(child, spawnOptions)
    awaits.push(interchain(spawn))
  }
  await Promise.all(awaits)
}
const mapInstaller = (options) => {
  const { covenant = 'unity', state = {} } = options
  const config = { covenant }
  return { state, config }
}
export { installReducer }
