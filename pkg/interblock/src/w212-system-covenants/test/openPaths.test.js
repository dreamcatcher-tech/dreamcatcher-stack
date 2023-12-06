import { interchain, schemaToFunctions } from '../../w002-api'
import { Engine } from '../../w210-engine'
import { shell } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:openPaths')

describe('openPaths', () => {
  const api = schemaToFunctions(shell.api)
  test(`basic`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    await engine.pierce(api.add('child1'))
    await engine.pierce(api.add('child1/nested1'))
    await engine.pierce(api.ping('child1/nested1'))
  })
  test(`rejects on unopenable path`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    await engine.pierce(api.add('child1'))
    await engine.pierce(api.add('child1/nested1'))
    const path = 'child1/nested1/false1'
    const false1 = engine.pierce(api.ping(path))
    await expect(false1).rejects.toThrow(`Segment not present: /${path}`)
  })
  test(`deep add throws`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    // TODO make error message be more specific
    await expect(() =>
      engine.pierce(api.add('child1/nested1'))
    ).rejects.toThrow(`Segment not present: `)
  })
  test(`opens absolute paths`, async () => {
    const reducer = async (request) => {
      if (request.type === 'TEST') {
        await interchain('@@PING', {}, '/')
      }
    }

    const engine = await Engine.createCI({
      overloads: { root: shell, '/test': { reducer } },
    })
    await engine.pierce(api.add('child1', '/test'))

    await engine.pierce(api.dispatch({ type: 'TEST', payload: {} }, 'child1'))
  })
  test.todo('no double open')
})
