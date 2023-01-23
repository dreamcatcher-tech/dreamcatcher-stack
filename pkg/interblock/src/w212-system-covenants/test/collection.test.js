import { assert } from 'chai/index.mjs'
import { Interpulse } from '../..'
import Debug from 'debug'
const debug = Debug('crm:tests:collection')

describe.skip('collection', () => {
  const schema = {
    title: 'Customer',
    type: 'object',
    required: ['firstName'],
    properties: {
      firstName: { type: 'string' },
    },
  }
  const network = {
    address: {
      schema: {
        title: 'Address',
        type: 'object',
        properties: { address: { type: 'string' } },
      },
    },
  }
  const customerData = {
    formData: { firstName: 'test firstname' },
    network: { address: { state: { formData: { address: 'test address' } } } },
  }

  test('add with test data', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('col1', { covenant: 'collection' })
    const actions = await engine.actions('col1')
    const type = 'DATUM'
    await actions.setTemplate({ type, schema, network })
    const col = await engine.latest('col1')
    const colState = col.getState().toJS()
    debug(colState)
    assert(!colState.template.formData)
    assert(!colState.template.network.address.formData)
    debug('adding item to collection')

    await actions.add(customerData)
    const nextColState = await engine.latest('col1')
    assert.deepEqual(nextColState.getState(), col.getState())
    const customer = await engine.latest('col1/file_00001')
    assert(customer.getState().toJS().formData.firstName)
    // all covenants to respond to install events, and ignore or respond differently
    assert(!customer.getState().toJS().network.address.formData)
    const address = await engine.latest('col1/file_00001/address')
    assert(address.getState().formData.address)

    debug('adding second item to collection')
    engine.metro.enableLogging()
    await actions.add(customerData)
    const customer2 = await engine.latest('col1/file_00002')
    assert.strictEqual(
      customer2.getState().formData.firstName,
      'test firstname'
    )
  })
  test('add two items concurrently to collection', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('col1', 'collection')
    const actions = await engine.actions('col1')
    const namePath = ['firstName']
    await actions.setTemplate({ namePath, schema, network })

    debug('adding two customers concurrently')

    const customerData1 = { ...customerData, formData: { firstName: 'A' } }
    const customerData2 = { ...customerData, formData: { firstName: 'B' } }
    const await1 = actions.add(customerData1)
    const await2 = actions.add(customerData2)
    await await1
    await await2

    const customer1 = await engine.latest('col1/firstName-A')
    assert(customer1.getState().formData.firstName)
    const address = await engine.latest('col1/firstName-A/address')
    assert(address.getState().formData.address)

    const customer2 = await engine.latest('col1/firstName-B')
    assert(customer2.getState().formData.firstName)
  })

  test('batch add', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('col1', 'collection')
    const actions = await engine.actions('col1')
    const namePath = ['firstName']
    await actions.setTemplate({ namePath, schema, network })

    debug('batch adding customers')

    const c1 = { ...customerData, formData: { custNo: 1, firstName: 'A' } }
    const c2 = { ...customerData, formData: { custNo: 2, firstName: 'B' } }
    const c3 = { ...customerData, formData: { custNo: 3, firstName: 'C' } }
    const result1 = await actions.batch([c1, c2, c3])
    const c4 = { ...customerData, formData: { custNo: 4, firstName: 'D' } }
    const c5 = { ...customerData, formData: { custNo: 5, firstName: 'E' } }
    const c6 = { ...customerData, formData: { custNo: 6, firstName: 'F' } }
    const result2 = await actions.batch([c4, c5, c6])
    debug('result', result1)
    const customer1 = await engine.latest('col1/firstName-A')
    assert(customer1.getState().formData.firstName)
    const address = await engine.latest('col1/firstName-A/address')
    assert(address.getState().formData.address)

    const customer2 = await engine.latest('col1/firstName-B')
    assert(customer2.getState().formData.firstName)
  })
  test.todo('collection with initial state already set')
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
  test.todo('datum with collection child')
})
