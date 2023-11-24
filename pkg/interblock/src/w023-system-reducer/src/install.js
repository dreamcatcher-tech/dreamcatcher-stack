import assert from 'assert-fast'
import { Request } from '../../w008-ipld/index.mjs'
import { useState, useAI, interchain } from '../../w002-api'
import merge from 'lodash.merge'
import equals from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('interblock:dmz:install')

export const installReducer = async (payload) => {
  assert.strictEqual(typeof payload, 'object')
  assert.strictEqual(Object.keys(payload).length, 1)
  assert.strictEqual(typeof payload.installer, 'object')
  debug(`payload`, payload)
  const covenant = await interchain('@@COVENANT')
  debug(`covenant`, covenant)
  let { installer } = covenant.state
  installer = merge({}, installer, payload.installer)
  const { network = {}, state = {}, config = {}, ai = {} } = installer
  assert.strictEqual(typeof network, 'object')
  assert.strictEqual(typeof state, 'object')
  assert.strictEqual(typeof config, 'object')
  assert.strictEqual(typeof ai, 'object')

  if (!equals(state, {})) {
    const [, setState] = await useState()
    await setState(state)
  }
  if (!equals(ai, {})) {
    const [, setAI] = await useAI()
    await setAI(ai)
  }
  // TODO make all slices of the DMZ be updatable by a general interface
  await interchain('@@CONFIG', config)

  // TODO clean up failed partial deployments ?
  // TODO accomodate existing children already ? or throw ?

  const awaits = []
  for (const child in network) {
    debug('installing child: ', child)
    let installer = network[child]
    if (installer.covenant?.startsWith('#')) {
      const schemaPath = installer.covenant
      const childPath = covenant.path + schemaPath.substring(1)
      debug('relative covenant resolved from %s to %s', schemaPath, childPath)
      installer = { ...installer, covenant: childPath }
    }
    debug('installing child options: ', installer)
    const spawn = Request.createSpawn(child, installer)
    awaits.push(interchain(spawn))
  }
  await Promise.all(awaits)
}
