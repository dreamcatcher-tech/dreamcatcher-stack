import { Engine, schemaToFunctions } from '../../w210-engine'
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
    await expect(false1).rejects.toThrow(`Invalid Path: ${path}`)
  })
  test.todo('no double open')
})
