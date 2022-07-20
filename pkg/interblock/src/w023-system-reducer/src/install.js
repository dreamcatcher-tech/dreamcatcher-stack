import assert from 'assert-fast'
import { Request, Pulse } from '../../w008-ipld'
import { useState, interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 1)
  assert(payload.spawnOptions)
  debug(`payload`, payload)
  const covenantState = await interchain(Request.createGetCovenantState())
  debug(`covenantState`, covenantState)
  const { installer } = covenantState
  const { network = {}, state = {} } = installer
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
    const spawnOptions = network[child]
    debug('installing child options: ', spawnOptions)
    const spawn = Request.createSpawn(child, spawnOptions)
    awaits.push(interchain(spawn))
  }
  await Promise.all(awaits)
}
export { installReducer }
