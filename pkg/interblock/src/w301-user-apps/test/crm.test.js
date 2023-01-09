import { assert } from 'chai/index.mjs'
import { Interpulse } from '../..'
import { crm } from '..'
import Debug from 'debug'
const debug = Debug('tests')

const serverFactory = async ({ customerCount = 10 } = {}) => {
  const server = await Interpulse.createCI({
    overloads: { '/crm': crm.covenant },
  })
  await server.add('crm', { covenant: '/crm' })
  const crmActions = await server.actions('/crm/customers')
  const awaits = []
  for (let i = 1; i <= customerCount; i++) {
    const addPromise = crmActions.add({
      formData: { custNo: i, name: 'test name ' + i },
    })
    awaits.push(addPromise)
  }
  await Promise.all(awaits)
  return server
}

describe('crm', () => {
  describe('app deploy', () => {
    test.only('deploys app', async () => {
      const publishStart = Date.now()
      const engine = await Interpulse.createCI()
      const { path } = await engine.publish('dpkgCrm', crm.covenant)
      assert.strictEqual(path, '/dpkgCrm')
      const installStart = Date.now()
      const latest = await engine.latest('/dpkgCrm')
      expect(latest.provenance.dmz.covenant).toEqual('covenant')
      await engine.add('crm', { covenant: path })

      debug(`publish time: ${installStart - publishStart} ms`)
      debug(`install time: ${Date.now() - installStart} ms`)
      debug(`pulsecount: ${engine.logger.pulseCount}`)
      const testTime = Date.now() - publishStart
      debug(`test time: ${testTime} ms`)
      const pulseRate = Math.floor(testTime / engine.logger.pulseCount)
      debug(`pulserate: ${pulseRate}ms per block`)

      const exceptions = await engine.current('/crm/schedule/modifications')
      assert(exceptions.getState().toJS().datumTemplate)
      const about = await engine.latest('/crm/about')
      const aboutState = about.getState().toJS()
      expect(aboutState).toEqual(crm.covenant.installer.network.about.state)

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
    test('can only add customer if provide valid data', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
      })
      await engine.add('app', '/crm')
      const actions = await engine.actions('/app/customers')
      await engine.ping('/app/customers')
      const result = await actions.add({
        formData: { custNo: 1234, name: 'test1' },
      })
    })
    test.todo('add customer with test data using .processes/addTestCustomer')
  })
  describe('list customers', () => {
    test('list customers basic', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
      })
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
    test.skip('large customer list', async () => {
      const customerCount = 100
      const server = serverFactory({ customerCount })
      const { children } = await server.ls('crm/customers')
      debug(`customers: `, children)
      const realCustomers = Object.keys(children).filter(
        (key) => !key.startsWith('.')
      )
      assert.strictEqual(realCustomers.length, customerCount)
      debug(realCustomers)
    })
    test.skip('search by name', async () => {
      const server = await serverFactory()
      // TODO mango style queries to look inside the customers
      const results = await server.find('/crm/customers', {
        name: 'test name 3',
      })
      assert(results)
    })
  })
  describe('data import', () => {
    test.todo('imports customer data')
    test.todo('imports only diffs with current dataset')
  })
  describe('subscriptions', () => {
    test.todo('add a service to a customer')
  })
  describe.skip('symlinking', () => {
    test('rm symlink leaves original data intact', async () => {
      const server = await serverFactory()
      await server.cd('/crm/routing')
      await server.rm('custNo-5')
      const state = server.cat('/crm/customers/custNo-5')
      assert(state)
    })
  })
  describe.skip('permissioning', () => {
    test('cannot alter app structure', async () => {
      const server = await serverFactory({ customerCount: 10 })
      const client = await Interpulse.createCI({ seed: 'clientRandomness' })
      await client.mount('/remoteApp', server.address)
      await client.cd('/remoteApp')
      await expect(client.rm()).rejects.toThrow('access denied')
    })
  })
  describe.skip('clients and server', () => {
    test('basic', async () => {
      const server = await serverFactory()
      const client = await Interpulse.createCI({ seed: 'clientRandomness' })
      await client.mount('/remoteApp', server.address)
      await client.cd('/remoteApp')
      const lsResult = await client.ls()
      assert(lsResult)
    })
    test('passive client updates', async () => {
      const server = await serverFactory()

      const active = await Interpulse.createCI({ seed: 'active' })
      await active.mount('/remoteApp', server.address)
      await active.cd('/remoteApp/customers/custNo-5/serviceAddress')
      const actions = await active.actions()
      await actions.update({ street: 'some other street' })

      const passive = await Interpulse.createCI({ seed: 'passive' })
      await passive.mount('/remoteApp', server.address)
      await passive.cd('/remoteApp/customers/custNo-5/serviceAddress')
      const state = await passive.cat()
      assert(state)
    })
    test.todo('new client syncs with peer while server offline')
    test.todo('two peers share local changes while server offline')
  })
  describe('stress test', () => {
    test.todo('simulate multiple users putting stress on the system')
    test.todo('20,000 test customers added')
  })
})
