import assert from 'assert-fast'
import { Request, Pulse } from '../../w008-ipld'
import { useState, interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 0)
  const covenantPulse = await interchain(Request.createGetCovenantPulse())
  assert(covenantPulse instanceof Pulse)
  const { installer = {}, state = {} } = covenantPulse.getState().toJS()
  assert.strictEqual(typeof installer, 'object')
  assert.strictEqual(typeof state, 'object')

  // TODO clean up failed partial deployments ?
  // TODO accomodate existing children already ? or throw ?
  if (Object.keys(state).length) {
    const [currentState, setState] = await useState()
    assert.strictEqual(Object.keys(currentState).length, 0)
    await setState(state)
  }
  const awaits = []
  for (const child in installer) {
    debug('installing child: ', child)
    const { network, ...rest } = installer[child]
    const spawnOptions = mapInstaller(rest)
    const spawnRequest = Request.createSpawn(child, spawnOptions)
    awaits.push(interchain(spawnRequest))
  }
  await Promise.all(awaits)
}
const mapInstaller = (options) => {
  const { covenant = 'unity', state = {} } = options
  const config = { covenant }
  return { state, config }
}
export { installReducer }
