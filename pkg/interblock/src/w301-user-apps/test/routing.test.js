import { Interpulse } from '../../index.mjs'
import Debug from 'debug'
import { crm } from '..'
const { customers, routing } = crm.faker
const debug = Debug('tests')

describe('routing', () => {
  test('update', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    const rBatch = routing.generateBatch(2)
    await engine.execute('routing/batch', { batch: rBatch })
    const batch = customers.generateBatchInside(rBatch, 5)
    const count = 3
    const noReset = true
    const outs = customers.generateBatchOutside(rBatch, count, noReset)
    batch.push(...outs)
    await engine.execute('customers/batch', { batch })

    await engine.execute('routing/update', '/customers')

    for (const [index, { formData }] of rBatch.entries()) {
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
    expect(state.formData.unassigned.length).toEqual(count)
    expect(state).toMatchSnapshot()
  })
  test('update twice does not reset unapproved', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('routing', '/crm/routing')
    await engine.add('customers', '/crm/customers')

    const rBatch = routing.generateSingle()
    const { alias } = await engine.execute('routing/add', rBatch)
    const batch = customers.generateBatchInside([rBatch], 5)
    await engine.execute('customers/batch', { batch })
    await engine.execute('routing/update', '/customers')

    const sector = await engine.current(`routing/${alias}`)
    const { formData } = sector.getState().toJS()
    const { unapproved, ...rest } = formData
    debug('order', rest.order, unapproved)
    expect(unapproved).toEqual(rest.order)
    await engine.execute(`routing/${alias}/set`, { formData: rest })
    const allApproved = await engine.current(`routing/${alias}`)
    expect(allApproved.getState().toJS().formData.unapproved).toBeUndefined()

    await engine.execute('routing/update', '/customers')

    const unchanged = await engine.current(`routing/${alias}`)
    expect(unchanged.getState().toJS().formData.unapproved).toBeUndefined()
  })
  test.todo('edit a sector')
  test.todo('edit a customer')
  test.todo('no sector adds to the unassigned sector')
})
