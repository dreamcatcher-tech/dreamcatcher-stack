import { assert } from 'chai/index.mjs'
import { jest } from '@jest/globals'
import { effectorFactory, awsFactory } from '../../w020-emulators'
import { crm } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:crm')
Debug.enable('*tests:crm *met* *shell *deploy *isolator')

describe('crm', () => {
  jest.setTimeout(1500)
  describe('app deploy', () => {
    test.only('deploys app', async () => {
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
      const newCustomer = await crmActions.add()
      debug(`newCustomer`, newCustomer)
      await shell.settle()
      /**
       * 2021-01-18 400ms publish, 1144ms install, blockcount: 21
       * 2021-01-18 218ms publish, 709ms install - fast-xstate on all but increasor and transmit
       * 2021-01-25 151ms publish, 371ms install - removed xstate
       * 2021-01-26 153ms publish, 356ms install - removed birthblocks
       * 2021-01-28 187ms publish, 670ms install, blockcount 29 - deploy larger app with higher blockcound
       * 2021-01-28 183ms publish, 545ms install, blockcount 29 - cache partial dmz executions
       * 2021-02-04 176ms publish, 382ms install, blockcount 29, blockrate 19ms - remove immer, cache blank creates, reuse hashes for block and interblock
       * 2021-05-19 245ms publish, 524ms install, blockcount 27, blockrate 28ms - add queries to hooks, install uses a query instead of an action
       */
    })
    test.todo('can only add customer if provide valid data')
    test.todo('add customer with test data using .processes/addTestCustomer')
  })
  describe('list customers', () => {
    test('list customers basic', async () => {
      const shell = await effectorFactory('crm')
      const { dpkgPath } = await shell.publish(
        'dpkgCrm',
        crm.installer,
        crm.covenantId
      )
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      assert(shell.dpkgCrm)
      await shell.install(dpkgPath, 'crm')
      shell.metro.enableLogging()
      const newCustomer = await shell.crm.customers.add({ isTestData: true })
      debug(`newCustomer`, newCustomer)
      const { children } = await shell.ls('crm/customers')
      debug(`customers: `, children)
      const realCustomers = Object.keys(children).filter(
        (key) => !key.startsWith('.')
      )
      assert.strictEqual(realCustomers.length, 1)
      debug(realCustomers)
      await shell.settle()
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
