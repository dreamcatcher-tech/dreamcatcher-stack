import { Interpulse } from '../..'
import { Pulse } from '../../w008-ipld'
import { crm } from '../../w301-user-apps'
import Debug from 'debug'
const debug = Debug('tests')

describe('Car', () => {
  test('export', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('app', '/crm')
    const car = await engine.export('/app')
    debug('car', car)

    const blank = await Interpulse.createCI()
    Debug.enable('tests Interpulse')
    debug('import start')
    const { roots, count } = await blank.import(car)
    debug('import end')
    expect(count).toBe(91)
    expect(roots.length).toBe(1)
    expect(roots[0]).toBeInstanceOf(Pulse)
  })
})
