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
      /**
       * 2021-01-18 400ms publish, 1144ms install, blockcount: 21
       * 2021-01-18 218ms publish, 709ms install - fast-xstate on all but increasor and transmit
       * 2021-01-25 151ms publish, 371ms install - removed xstate
       * 2021-01-26 153ms publish, 356ms install - removed birthblocks
       * 2021-01-28 187ms publish, 670ms install, blockcount 29 - deploy larger app with higher blockcound
       * 2021-01-28 183ms publish, 545ms install, blockcount 29 - cache partial dmz executions
       * 2021-02-04 176ms publish, 382ms install, blockcount 29, blockrate 19ms - remove immer, cache blank creates, reuse hashes for block and interblock
       * 2021-05-19 245ms publish, 524ms install, blockcount 27, blockrate 28ms - add queries to hooks, install uses a query instead of an action
       * 2021-11-11 129ms publish, 252ms install, blockcount 27, blockrate 14ms add1 167ms, add1 count 18, add2 128ms, add2 count 13 - remove light lineage from protocol
       * 2021-12-27 185ms publish, 420ms install, blockcount 27, blockrate 22ms add1 258ms, add1 count 17, add2 205ms, add2 count 13 - models as classes
       * 2022-07-25 136ms publish, 330ms install, pulsecount 30, blockrate 15ms add1 218ms, add1 count 20, add2 161ms, add2 count 15 - move to ipfs
       */
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
