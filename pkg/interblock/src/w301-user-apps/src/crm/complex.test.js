import Debug from 'debug'
const debug = Debug('test')
describe('complex', () => {
  it('generates customer data', async () => {
    const { generateCustomers } = await import('./faker/customers')
    const customers = generateCustomers(29)
    expect(customers.network.length).toEqual(29)
  })
  it('calculates sector memberships', async () => {
    debug('start')
    const { default: faker } = await import('./faker')
    debug('loaded faker')
    const routing = faker(100).child('routing')
    debug('created routing child')
    let orderCount = 0
    for (const sector of routing.network) {
      const { state } = sector
      const { order } = state.formData
      orderCount += order.length
    }
    expect(orderCount).toBeGreaterThan(10)
    debug('orderCount', orderCount)
  })
})
