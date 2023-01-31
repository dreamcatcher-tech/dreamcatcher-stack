import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('routing', () => {
  beforeEach(() => customers.reset())
  test('update', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    const routingBatch = routing.generateBatch(2)
    await engine.execute('routing/batch', { batch: routingBatch })
    const batch = customers.generateBatchInside(routingBatch, 5)
    const outsideCount = 3
    const outside = customers.generateBatchOutside(routingBatch, outsideCount)
    batch.push(...outside)
    await engine.execute('customers/batch', { batch })

    await engine.execute('routing/update', '/customers')

    Debug.enable('tests')
    for (const [index, { formData }] of routingBatch.entries()) {
      const sector = await engine.current(`routing/${index}`)
      const state = sector.getState().toJS()
      const {
        formData: { order, unapproved, ...rest },
      } = state
      debug('order', order)
      expect(rest).toEqual(formData)
      if (Array.isArray(order)) {
        expect(order).toEqual(unapproved)
      }
      expect(order).toMatchSnapshot()
      expect(unapproved).toMatchSnapshot()
    }
    const routingLatest = await engine.current('routing')
    const state = routingLatest.getState().toJS()
    expect(state.formData.unassigned.length).toEqual(outsideCount)
    expect(state).toMatchSnapshot()
  })
  test.todo('edit a sector')
  test.todo('edit a customer')
  test.todo('no sector adds to the unassigned sector')
})
