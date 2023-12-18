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
    debug('begin export')
    const car = await engine.export('/app')
    debug('export complete')

    const blank = await Interpulse.createCI()
    debug('import start')
    const { roots, count } = await blank.import(car)
    debug('import end')
    expect(count).toMatchSnapshot()
    expect(roots.length).toBe(1)
    const [imported] = roots
    expect(imported).toBeInstanceOf(Pulse)

    const result = await blank.insert(imported.cid.toString(), 'forked')
    const forkedCurrent = await blank.current('forked')
    expect(imported.cid.toString()).toBe(forkedCurrent.cid.toString())
    // TODO address should be different at the insertion ?
    const schedule = await blank.current('forked/schedules')
    expect(schedule).toBeInstanceOf(Pulse)
    const originalPulseId = schedule.toString()
    debug('originalPulseId', originalPulseId)

    debug('begin write to fork')
    await blank.ping('forked/schedules')
    debug('end write to fork')

    const forkedSchedule = await blank.current('forked/schedules')
    // ? did it not update its parent ?
    const forkedPulseId = forkedSchedule.toString()
    debug('forkedPulseId', forkedPulseId)
    expect(forkedPulseId).not.toBe(originalPulseId)
  })
})
