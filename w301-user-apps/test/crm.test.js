const assert = require('assert')
const { effectorFactory, awsFactory } = require('../../w020-emulators')
const { crm } = require('../src/crm')
const debug = require('debug')('interblock:tests:crm')
require('debug').enable('')

describe('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      const publishStart = Date.now()
      const shell = await effectorFactory('crm')
      shell.enableLogging()
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.install)
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      assert(shell.dpkgCrm)
      const installStart = Date.now()
      await shell.install(dpkgPath, 'crm')

      assert(shell.crm)
      debug(`publish time: ${installStart - publishStart} ms`)
      debug(`install time: ${Date.now() - installStart} ms`)
      debug(`blockcount: ${shell.getBlockCount()}`)
      const testTime = Date.now() - publishStart
      debug(`test time: ${testTime} ms`)
      const blockRate = Math.floor(testTime / shell.getBlockCount())
      debug(`blockrate: ${blockRate}ms per block`)

      const { state } = await shell.getLatestFromPath('/crm/about')
      assert(state.schema)

      const newCustomer = await shell.crm.customers.add({ isTestData: true })
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
       */
    })
    test.todo('can only add customer if provide valid data')
    test.todo('add customer with test data using .processes/addTestCustomer')
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
