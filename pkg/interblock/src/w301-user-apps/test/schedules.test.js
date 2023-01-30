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
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')
    await engine.add('schedules', '/crm/schedules')

    const routingBatch = routing.generateBatch(1)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatchInside(routingBatch, 1)
    await engine.execute('customers/batch', { batch })

    await engine.execute('routing/update', '/customers')
    Debug.enable('tests iplog faker:customers crm:schedules')
    const runDate = '2022-01-23'
    await engine.execute('schedules/add', {
      formData: { runDate },
    })

    const manifest = await engine.current(`/schedules/${runDate}`)
    debug(manifest.getState().toJS())

    // trigger the update so the sectors compute the order of customers

    // use selectors to view the schedules, tolerant of being present or not

    // make collections allow generating a virtual js version
  })
})
