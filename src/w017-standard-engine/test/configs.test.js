import { assert } from 'chai/index.mjs'
import * as configObj from '../src/configs'

describe('configs', () => {
  test('all config function names are present in the machines', () => {
    const machineArgs = {
      autoResolves: [{}],
      direct: [{}],
      dmz: [{}],
      increasor: [],
      interpreter: [() => true],
      isolator: [],
      pending: [{}],
      pool: [],
      receive: [],
      transmit: [],
    }
    const missingKeys = (obj, json) =>
      Object.keys(obj).filter(
        (key) =>
          !json.includes(`"${key}",`) &&
          !json.includes(`"${key}"}`) &&
          !json.includes(`"${key}"]`)
      )

    for (const name in machineArgs) {
      const args = machineArgs[name]
      const configName = name + `Config`
      const { machine, config } = configObj[configName](...args)
      const json = JSON.stringify(machine)
      assert.deepEqual(missingKeys(config.actions, json), [], name)
      assert.deepEqual(missingKeys(config.guards, json), [], name)
      assert.deepEqual(missingKeys(config.services, json), [], name)
    }

    // TODO test for names that are same across configs, but not included in common
  })
})
