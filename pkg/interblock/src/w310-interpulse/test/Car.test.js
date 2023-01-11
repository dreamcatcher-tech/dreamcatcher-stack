import { Interpulse } from '../..'
import { Pulse } from '../../w008-ipld'
import { crm } from '../../w301-user-apps'
import Debug from 'debug'
import all from 'it-all'
const debug = Debug('tests')

describe('Car', () => {
  test.only('export', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('app', '/crm')
    const car = await engine.export('/app')
    debug('car', car)

    const blank = await Interpulse.createCI()
    const { roots, count } = await blank.import(car)
    expect(roots.length).toBe(1)
    expect(count).toBe(91)
    expect(roots.every((root) => root instanceof Pulse)).toBeTruthy()
  })
})
