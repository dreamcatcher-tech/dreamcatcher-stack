import Debug from 'debug'
const debug = Debug('test')
Debug.enable('test faker*')
describe('complex', () => {
  it('generates customer data', async () => {
    const { customers } = await import('./faker/customers')
  })
  it.only('calculates sector memberships', async () => {
    debug('start')
    const { default: faker } = await import('./faker')
    debug('loaded faker')
    const routing = faker.child('routing')
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
