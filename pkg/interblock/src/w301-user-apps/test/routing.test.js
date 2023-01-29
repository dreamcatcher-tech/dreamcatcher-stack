import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('routing', () => {
  test.only('sectors before customers', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    const routingBatch = routing.slice(0, 3)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatch(5)
    await engine.execute('customers/batch', { batch })

    Debug.enable('tests iplog *routing')
    await engine.execute('routing/update', '/customers')

    const results = [undefined, undefined, ['779']]
    for (const [index, { formData }] of routingBatch.entries()) {
      const sector = await engine.latest(`routing/${index}`)
      const state = sector.getState().toJS()
      const {
        formData: { order, ...rest },
      } = state
      expect(rest).toEqual(formData)
      debug('order', order)
      expect(order).toStrictEqual(results[index])
    }
  })
  test('customers before sectors', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('customers', '/crm/customers')
    await engine.add('routing', '/crm/routing')

    Debug.enable('tests iplog')
    const batch = customers.generateBatch(10)
    await engine.execute('customers/batch', { batch })
    const routingBatch = routing.slice(0, 5)
    await engine.execute('routing/batch', { batch: routingBatch })

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
  test.todo('edit a sector')
  test.todo('edit a customer')
})
