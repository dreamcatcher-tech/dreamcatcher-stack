import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('schedule', () => {
  test('single', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    const routingBatch = routing.generateBatch(1)
    const batch = customers.generateBatchInside(routingBatch, 1)
    await engine.executeConcurrent([
      { add: { path: 'routing', installer: '/crm/routing' } },
      { add: { path: 'customers', installer: '/crm/customers' } },
      { add: { path: 'schedules', installer: '/crm/schedules' } },
    ])
    await engine.executeConcurrent({
      '/routing/batch': { batch: routingBatch },
      '/customers/batch': { batch },
    })
    await engine.execute('/routing/update', { path: '/customers' })
    const sector0 = await engine.current('/routing/0')
    const approved = sector0.getState().toJS().formData.unapproved
    await engine.execute('/routing/approve', { sectorId: '0', approved })

    const runDate = '2023-01-23'
    await engine.execute('/schedules/create', runDate, '/routing', '/customers')
    const schedule = await engine.current(`/schedules/${runDate}`)
    const state = schedule.getState().toJS()
    debug('state', state)

    const run = await engine.current(`/schedules/${runDate}/0`)
    const runState = run.getState().toJS()
    debug('runState', runState)
    expect(runState.formData.order).toEqual(['777'])
    await engine.stop()
  })
  test.todo('publish rejects if unordered customers')
})
