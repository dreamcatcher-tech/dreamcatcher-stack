import { assert } from 'chai/index.mjs'
import { Interpulse } from '../../w300-interpulse'
import { crm } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:crm')

describe('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      // Debug.enable('*tests*')
      const publishStart = Date.now()
      const engine = await Interpulse.createCI()
      const { path } = await engine.publish('dpkgCrm', crm)
      assert.strictEqual(path, '/dpkgCrm')
      const installStart = Date.now()
      await engine.add('crm', { covenant: path })

      debug(`publish time: ${installStart - publishStart} ms`)
      debug(`install time: ${Date.now() - installStart} ms`)
      debug(`pulsecount: ${engine.logger.pulseCount}`)
      const testTime = Date.now() - publishStart
      debug(`test time: ${testTime} ms`)
      const pulseRate = Math.floor(testTime / engine.logger.pulseCount)
      debug(`pulserate: ${pulseRate}ms per block`)

      const exceptions = await engine.latest('/crm/schedule/exceptions')
      assert(exceptions.getState().toJS().datumTemplate)
      const about = await engine.latest('/crm/about')
      const aboutState = about.getState().toJS()
      expect(aboutState).toEqual(crm.installer.network.about.state)

      const crmActions = await engine.actions('/crm/customers')
      const add1Start = Date.now()
      const add1PulseCount = engine.logger.pulseCount
      await crmActions.add({ formData: { custNo: 100, name: 'test name 1' } })
      debug(`add first customer time: ${Date.now() - add1Start} ms`)
      const add2PulseCount = engine.logger.pulseCount
      debug(`add 1 pulse count: ${add2PulseCount - add1PulseCount}`)

      const add2Start = Date.now()
      await crmActions.add({ formData: { custNo: 101, name: 'test name 2' } })
      debug(`add second customer time: ${Date.now() - add2Start} ms`)
      const lastPulseCount = engine.logger.pulseCount
      debug(`add 2 pulse count: ${lastPulseCount - add2PulseCount}`)
    })
    test.todo('can only add customer if provide valid data')
    test.todo('add customer with test data using .processes/addTestCustomer')
  })
  describe('list customers', () => {
    test('list customers basic', async () => {
      const engine = await Interpulse.createCI({ overloads: { '/crm': crm } })
      await engine.add('crm', { covenant: '/crm' })
      const crmActions = await engine.actions('/crm/customers')
      const newCustomer = await crmActions.add({
        formData: { custNo: 100, name: 'test name 1' },
      })
      debug(`newCustomer`, newCustomer)
      const { children } = await engine.ls('crm/customers')
      debug(`customers: `, children)
      const realCustomers = Object.keys(children).filter(
        (key) => !key.startsWith('.')
      )
      assert.strictEqual(realCustomers.length, 1)
      debug(realCustomers)
    })
  })
  describe('data import', () => {
    test.todo('imports customer data')
    test.todo('bulk data upload')
  })
  describe('edit customer', () => {
    test.todo('update customer name')
    // shows tripping off a state machine to update multiple datums in response
    test.todo('add a service to a customer')
  })
  describe('general use', () => {
    test.todo('cannot alter the structure of the application in any way')
  })
  describe('stress test', () => {
    test.todo('20,000 test customers added')
  })
})
