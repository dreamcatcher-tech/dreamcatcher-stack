const assert = require('assert')
describe('configs', () => {
  test('all config function names are present in the machines', () => {
    const machines = {
      direct: [{}],
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

    for (const name in machines) {
      const configName = name + 'Config'
      const configObj = require('../src/configs/' + configName + '.js')
      const args = machines[name]
      const { machine, config } = configObj[configName](...args)
      const json = JSON.stringify(machine)
      assert.deepStrictEqual(missingKeys(config.actions, json), [], name)
      assert.deepStrictEqual(missingKeys(config.guards, json), [], name)
      assert.deepStrictEqual(missingKeys(config.services, json), [], name)
    }

    // TODO test for names that are same across configs, but not included in common
  })
})
