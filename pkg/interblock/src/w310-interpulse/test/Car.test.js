import { Interpulse } from '../..'
import { Pulse } from '../../w008-ipld'
import { crm } from '../../w301-user-apps'
import Debug from 'debug'
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
    debug('import start')
    const { roots, count } = await blank.import(car)
    debug('import end')
    expect(count).toBe(91)
    expect(roots.length).toBe(1)
    const [imported] = roots
    expect(imported).toBeInstanceOf(Pulse)

    await blank.insert(imported.cid.toString(), 'forked')
    const forkedCurrent = await blank.current('forked')
    expect(imported.cid.toString()).toBe(forkedCurrent.cid.toString())
    const schedule = await blank.latest('forked/schedule')
    expect(schedule).toBeInstanceOf(Pulse)
    const originalAddress = schedule.getAddress()

    debug('begin write to fork')
    await blank.ping('forked/schedule')
    debug('end write to fork')
    const forkedSchedule = await blank.latest('forked/schedule')
    expect(forkedSchedule.getAddress()).not.toBe(originalAddress)
  })
})
