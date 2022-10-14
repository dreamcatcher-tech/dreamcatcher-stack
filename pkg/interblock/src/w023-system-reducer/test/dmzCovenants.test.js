import { Interpulse } from '../../w310-interpulse'
import { unity } from '../../w212-system-covenants'
import Debug from 'debug'
const debug = Debug('tests')

describe('dmzCovenants', () => {
  test('publish', async () => {
    const engine = await Interpulse.createCI()
    const covenant = { ...unity, name: 'published' }
    const { path } = await engine.publish('published', covenant)
    const latest = await engine.latest(path)
    expect(latest.provenance.dmz.covenant).toEqual('covenant')
    expect(latest.getState().toJS().name).toEqual('published')
    await engine.add('test', { covenant: path })
  })
})
