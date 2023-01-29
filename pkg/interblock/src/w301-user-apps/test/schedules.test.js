import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('schedules', () => {
  test('single', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')
    await engine.add('schedules', '/crm/schedules')

    Debug.enable('tests iplog')
    const routingBatch = routing.slice(0, 5)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatch(10)
    await engine.execute('customers/batch', { batch })

    // trigger the update so the sectors compute the order of customers
  })
})
