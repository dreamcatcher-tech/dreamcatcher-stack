import { Interpulse } from '../../w310-interpulse'
import { Request } from '../../w008-ipld'
import { Engine } from '../../w210-engine'
import { unity } from '../../w212-system-covenants'
import Debug from 'debug'
const debug = Debug('tests')

describe('dmzCovenants', () => {
  test('basic', async () => {
    const engine = await Interpulse.createCI()
    const request = Request.createGetCovenantState()
    const action = { ...request }
    const result = await engine.dispatch(action, '.')
    expect(result).toMatchSnapshot()
    debug(`result`, Object.keys(result))
    const latest = engine.selfLatest
    await engine.add('child1')
    const cr = await engine.dispatch(action, 'child1')
    expect(cr).toMatchSnapshot()
  })
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
