import { assert } from 'chai/index.mjs'
import { Engine } from '../src/Engine'
import Debug from 'debug'
import { interchain } from '../../w002-api'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:tests:covenants')
const root = {
  reducer: async (request) => {
    debug(`root request`, request)
    const spawnOptions = { covenant: '/child' }
    return await interchain(Request.createSpawn('testalias', spawnOptions))
  },
}
describe('user covenants', () => {
  test('@@INIT', async () => {
    let unreachableReached = false
    const child = {
      reducer: (request) => {
        debug(`child request:`, request)
        if (request.type === '@@INIT') {
          return { init: true }
        }
        unreachableReached = true
      },
    }

    const overloads = { root, '/child': child }
    const engine = await Engine.createCI({ overloads })
    const result = await engine.pierce(Request.create('test'))
    assert(!unreachableReached)
    assert(!result.init)
    assert.strictEqual(result.alias, 'testalias')
  })
  test('throw on @@INIT bubbles up', async () => {
    let unreachableReached = false
    const child = {
      reducer: (request) => {
        debug(`child request:`, request)
        if (request.type === '@@INIT') {
          throw new Error(`@@INIT test`)
        }
        unreachableReached = true
      },
    }
    const overloads = { root, '/child': child }
    const engine = await Engine.createCI({ overloads })
    const request = Request.create('test')
    await expect(engine.pierce(request)).rejects.toThrow('@@INIT test')
    assert(!unreachableReached)
  })
})
