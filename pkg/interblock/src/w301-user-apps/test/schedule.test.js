import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('schedule', () => {
  test.only('single', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    const routingBatch = routing.generateBatch(1)
    customers.reset()
    const batch = customers.generateBatchInside(routingBatch, 1)
    await engine.executeConcurrent([
      { add: { path: 'routing', installer: '/crm/routing' } },
      { add: { path: 'customers', installer: '/crm/customers' } },
      { add: { path: 'schedule', installer: '/crm/schedule' } },
    ])
    await engine.executeConcurrent({
      '/routing/batch': { batch: routingBatch },
      '/customers/batch': { batch },
    })
    await engine.execute('/routing/update', { path: '/customers' })
    const sector0 = await engine.current('/routing/0')
    const approved = sector0.getState().toJS().formData.unapproved
    await engine.execute('/routing/approve', { approved })

    Debug.enable('tests iplog faker:customers crm:schedule crm:routing')

    const runDate = '2023-01-23'
    // start the scheduling procedure
    await engine.execute('/schedule/create', runDate, '/routing')
    const manifest = await engine.current(`/schedule/${runDate}`)
    const state = manifest.getState().toJS()
    // include hardlinks to the routing and customers

    await engine.stop()
  })
  test.todo('publish rejects if unordered customers')
})
