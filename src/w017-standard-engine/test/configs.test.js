import assert from 'assert'
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
      assert.deepStrictEqual(missingKeys(config.actions, json), [], name)
      assert.deepStrictEqual(missingKeys(config.guards, json), [], name)
      assert.deepStrictEqual(missingKeys(config.services, json), [], name)
    }

    // TODO test for names that are same across configs, but not included in common
  })
})
