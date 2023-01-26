import { apps, Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('routing', () => {
  test.only('sectors before customers', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    Debug.enable('tests iplog')
    const routingBatch = routing.slice(0, 5)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatch(10)
    await engine.execute('customers/batch', { batch })

    for (const [index, { formData }] of routingBatch.entries()) {
      const sector = await engine.latest(`routing/${index}`)
      const state = sector.getState().toJS()
      const {
        formData: { order, ...rest },
      } = state
      expect(rest).toEqual(formData)
      expect(Array.isArray(order)).toBe(true)
      debug(order)
    }
  })
})
