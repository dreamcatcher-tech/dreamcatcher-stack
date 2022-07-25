import { Engine } from '../../w210-engine'
import { shell } from '..'
import Debug from 'debug'
describe('openPaths', () => {
  test(`basic`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    await engine.pierce(shell.api.add('child1'))
    await engine.pierce(shell.api.add('child1/nested1'))
    await engine.pierce(shell.api.ping('child1/nested1'))
  })
  test(`rejects on unopenable path`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    await engine.pierce(shell.api.add('child1'))
    await engine.pierce(shell.api.add('child1/nested1'))
    Debug.enable('iplog')
    const false1 = engine.pierce(shell.api.ping('child1/nested1/false1'))
    await expect(false1).rejects.toThrow('invalid')
  })
  test.todo('no double open')
})
