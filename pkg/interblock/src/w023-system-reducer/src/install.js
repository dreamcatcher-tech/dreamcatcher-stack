import assert from 'assert-fast'
import { Request, Pulse } from '../../w008-ipld'
import { useState, interchain } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 1)
  assert(payload.installer)
  debug(`payload`, payload)
  const covenantState = await interchain(Request.createGetCovenantState())
  debug(`covenantState`, covenantState)
  let { installer } = covenantState
  installer = { ...installer, ...payload.installer }
  const { network = {}, state = {} } = installer
  assert.strictEqual(typeof network, 'object')
  assert.strictEqual(typeof state, 'object')

  // TODO clean up failed partial deployments ?
  // TODO accomodate existing children already ? or throw ?
  const isPayloadState = !!payload.installer.state
  const isCovenantState = !!covenantState.installer.state
  if (!isPayloadState && isCovenantState) {
    const [currentState, setState] = await useState()
    console.dir(currentState, { depth: Infinity })
    assert.strictEqual(Object.keys(currentState).length, 0)
    await setState(state)
  }
  const awaits = []
  for (const child in network) {
    debug('installing child: ', child)
    const installer = network[child]
    debug('installing child options: ', installer)
    const spawn = Request.createSpawn(child, installer)
    awaits.push(interchain(spawn))
  }
  const results = await Promise.all(awaits)
}
export { installReducer }
