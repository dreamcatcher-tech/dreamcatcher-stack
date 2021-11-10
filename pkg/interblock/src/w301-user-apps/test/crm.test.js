import { assert } from 'chai/index.mjs'
import { jest } from '@jest/globals'
import { effectorFactory, awsFactory } from '../../w020-emulators'
import { crm } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:crm')
Debug.enable()

describe('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      const publishStart = Date.now()
      const shell = await effectorFactory('crm')
      shell.metro.enableLogging()
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.installer)
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      const installStart = Date.now()
      await shell.install(dpkgPath, 'crm')

      debug(`publish time: ${installStart - publishStart} ms`)
      debug(`install time: ${Date.now() - installStart} ms`)
      debug(`blockcount: ${shell.metro.getBlockCount()}`)
      const testTime = Date.now() - publishStart
      debug(`test time: ${testTime} ms`)
      const blockRate = Math.floor(testTime / shell.metro.getBlockCount())
      debug(`blockrate: ${blockRate}ms per block`)

      const { state } = await shell.metro.getLatestFromPath('/crm/about')
      assert(state.schema)

      const crmActions = await shell.actions('/crm/customers')
      const add1Start = Date.now()
      const add1BlockCount = shell.metro.getBlockCount()
      await crmActions.add({ formData: { custNo: 100, name: 'test name 1' } })
      debug(`add first customer time: ${Date.now() - add1Start} ms`)
      const add2BlockCount = shell.metro.getBlockCount()
      debug(`add 1 block count: ${add2BlockCount - add1BlockCount}`)

      const add2Start = Date.now()
      await crmActions.add({ formData: { custNo: 101, name: 'test name 2' } })
      debug(`add second customer time: ${Date.now() - add2Start} ms`)
      const lastBlockCount = shell.metro.getBlockCount()
      debug(`add 2 block count: ${lastBlockCount - add2BlockCount}`)

      await shell.metro.settle()
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
       */
    })
    test.todo('can only add customer if provide valid data')
    test.todo('add customer with test data using .processes/addTestCustomer')
  })
  describe('list customers', () => {
    test('list customers basic', async () => {
      const shell = await effectorFactory('crm')
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.installer)
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      await shell.install(dpkgPath, 'crm')
      shell.metro.enableLogging()
      const crmActions = await shell.actions('/crm/customers')
      const newCustomer = await crmActions.add({
        formData: { custNo: 100, name: 'test name 1' },
      })
      debug(`newCustomer`, newCustomer)
      const { children } = await shell.ls('crm/customers')
      debug(`customers: `, children)
      const realCustomers = Object.keys(children).filter(
        (key) => !key.startsWith('.')
      )
      assert.strictEqual(realCustomers.length, 1)
      debug(realCustomers)
      await shell.metro.settle()
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
