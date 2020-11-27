const assert = require('assert')
const { effectorFactory, awsFactory } = require('../../w020-emulators')

describe.skip('crm', () => {
  describe('app deploy', () => {
    test('deploys app', async () => {
      // lay out basic app, with restrictions on data types
      // cannot alter the structure of the application in any way
      // when navigate to customers, can only add one if provide valid data
      // can invoke .processes/addTestCustomer to auto generate some test data
    })
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
