const assert = require('assert')
const { effectorFactory, awsFactory } = require('../../w020-emulators')
const { crm } = require('../src/crm')
const debug = require('debug')('crm:tests:installer')
require('debug').enable('*met* *needle')

describe('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      jest.setTimeout(10000)
      const shell = await effectorFactory('crm')
      shell.enableLogging()
      // set up dpkg by publishing the current code to the local registry
      const { dpkgPath } = await shell.publish('dpkgCrm', crm.install)
      assert.strictEqual(dpkgPath, 'dpkgCrm')
      assert(shell.dpkgCrm)
      // call install on path to deploy the crm app to
      await shell.install(dpkgPath, 'crm')

      assert(shell.crm)

      await shell.settle()
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
    test('basic activities', async () => {
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
