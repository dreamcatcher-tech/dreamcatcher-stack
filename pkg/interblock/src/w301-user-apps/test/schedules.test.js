import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('schedules', () => {
  test.only('single', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    const routingBatch = routing.generateBatch(1)
    const batch = customers.generateBatchInside(routingBatch, 1)
    await Promise.all([
      engine.add('routing', '/crm/routing'),
      engine.add('customers', '/crm/customers'),
      engine.add('schedules', '/crm/schedules'),
      engine.execute('routing/batch', { batch: routingBatch }),
      engine.execute('customers/batch', { batch }),
    ])

    Debug.enable('tests iplog faker:customers crm:schedules crm:routing')
    // this batch should trigger updates to the order in the sectors

    const runDate = '2022-01-23'
    const publishedDate = '2023-01-30T23:42:24+00:00'
    await engine.execute('schedules/add', {
      formData: { runDate, publishedDate },
    })

    const manifest = await engine.current(`/schedules/${runDate}`)
    const state = manifest.getState().toJS()
    expect(state).toMatchSnapshot()
    // include hardlinks to the routing and customers

    // use selectors to view the schedules, tolerant of being present or not

    // make collections allow generating a virtual js version
  })
  test.todo('publish rejects if unordered customers')
})
