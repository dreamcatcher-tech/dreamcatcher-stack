import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('routing', () => {
  beforeEach(() => customers.reset())
  test('basic', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    const routingBatch = routing.generateBatch(2)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatchInside(routingBatch, 5)
    await engine.execute('customers/batch', { batch })

    await engine.execute('routing/update', '/customers')

    for (const [index, { formData }] of routingBatch.entries()) {
      const sector = await engine.latest(`routing/${index}`)
      const state = sector.getState().toJS()
      const {
        formData: { order, ...rest },
      } = state
      expect(rest).toEqual(formData)
      debug('order', order)
      expect(order).toMatchSnapshot()
    }
  })
  test.todo('edit a sector')
  test.todo('edit a customer')
})
