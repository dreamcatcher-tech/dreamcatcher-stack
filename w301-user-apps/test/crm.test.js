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
    test.todo(
      'when navigate to customers, can only add one if provide valid data'
    )
    test.todo('add customer with test data using .processes/addTestCustomer')
  })
  describe('data import', () => {
    test('loads data', async () => {
      const client = await effectorFactory('imp')
      const app = require('../src/crm.config')
      client.emulateAws(app.covenants)

      // read in some customer data
      // dispatch so new customer is added

      await client.install(app) // do the install on aws
      client.cd('/apps/crm').cd('customers').dispatch('addTestCustomer')
    })
    test('nested child creation in datum', () => {
      // make a customer, and show the data being broken up automatically to children
      const payload = { isTest: true }
      client.dispatch({ type: 'ADD', payload }, '/apps/crm/customers')
    })
    test.todo('bulk data upload')
  })
  describe('edit customer', () => {
    test.todo('update customer name')
    test('add a service to a customer', async () => {
      // shows tripping off a state machine to update multiple datums in response
    })
  })
  describe('general use', () => {
    test.todo('cannot alter the structure of the application in any way')
    test('basic activities', async () => {
      const client = boot()
      await client
        .cd('/apps/crm')
        .cd('customers')
        .dispatch('addTestCustomer')
        .ls()
        .cd(0)
        .ls()
        .cd('serviceAddress')
        .ls()
        .cd('../..')
        .rm(0)
        .exit()
    })
  })
  describe('stress test', () => {
    test.todo('20,000 test customers added')
  })
})
