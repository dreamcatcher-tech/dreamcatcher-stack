import { Engine } from '../../w210-engine'
import { shell } from '..'
import Debug from 'debug'
Debug.enable('iplog')
describe('openPaths', () => {
  test.only(`basic`, async () => {
    const engine = await Engine.createCI({ overloads: { root: shell } })
    await engine.pierce(shell.api.add('child1'))
    await engine.pierce(shell.api.add('child1/nested1'))
    await engine.pierce(shell.api.ping('child1/nested1'))
  })
})
