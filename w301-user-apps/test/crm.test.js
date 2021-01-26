const assert = require('assert')
const { effectorFactory, awsFactory } = require('../../w020-emulators')
const { crm } = require('../src/crm')
const debug = require('debug')('interblock:tests:crm')
require('debug').enable('*met* *needle *tests* ')

describe('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      const publishStart = Date.now()
      const shell = await effectorFactory('crm')
      // shell.enableLogging()
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.install)
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      assert(shell.dpkgCrm)
      const installStart = Date.now()
      await shell.install(dpkgPath, 'crm')

      assert(shell.crm)
      debug(`publish time: ${installStart - publishStart} ms`)
      debug(`install time: ${Date.now() - installStart} ms`)
      debug(`blockcount: ${shell.getBlockCount()}`)
      debug(`test time: ${Date.now() - publishStart} ms`)
      await shell.settle()
      /**
       * 2021-01-18 400ms publish, 1144ms install, blockcount: 21
       * 2021-01-18 218ms publish, 709ms install - fast-xstate on all but increasor and transmit
       * 2021-01-25 151ms publish, 371ms removed xstate
       * 2021-01-26 153ms publish, 356ms removed birthblocks
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
    test.skip('basic activities', async () => {
      const shell = await effectorFactory('crm')
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.install)
      await shell.install(dpkgPath, 'crm')
      // await shell
      //   .cd('/crm')
      //   .cd('customers')
      //   .dispatch('addTestCustomer')
      //   .ls()
      //   .cd(0)
      //   .ls()
      //   .cd('serviceAddress')
      //   .ls()
      //   .cd('../..')
      //   .rm(0)
      //   .exit()
    })
  })
  describe('stress test', () => {
    test.todo('20,000 test customers added')
  })
})
