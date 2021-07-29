import assert from 'assert'
import { autoResolves } from '../src/configs/autoResolvesConfig'
import { direct } from '../src/configs/directConfig'
import { dmz } from '../src/configs/dmzConfig'
import { increasor } from '../src/configs/increasorConfig'
import { interpreter } from '../src/configs/interpreterConfig'
import { isolator } from '../src/configs/isolatorConfig'
import { pending } from '../src/configs/pendingConfig'
import { pool } from '../src/configs/poolConfig'
import { receive } from '../src/configs/receiveConfig'
import { transmit } from '../src/configs/transmitConfig'

const configObj = {
  autoResolves,
  direct,
  dmz,
  increasor,
  interpreter,
  isolator,
  pending,
  pool,
  receive,
  transmit,
}

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
      const args = machines[name]
      const { machine, config } = configObj[name](...args)
      const json = JSON.stringify(machine)
      assert.deepStrictEqual(missingKeys(config.actions, json), [], name)
      assert.deepStrictEqual(missingKeys(config.guards, json), [], name)
      assert.deepStrictEqual(missingKeys(config.services, json), [], name)
    }

    // TODO test for names that are same across configs, but not included in common
  })
})
