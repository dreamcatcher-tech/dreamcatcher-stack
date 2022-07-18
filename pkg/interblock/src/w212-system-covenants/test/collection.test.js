import { assert } from 'chai/index.mjs'
import { Interpulse } from '../..'
import Debug from 'debug'
const debug = Debug('crm:tests:collection')
Debug.enable('*collection iplog *install')

describe('collection', () => {
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
    network: { address: { formData: { address: 'test address' } } },
  }

  test.only('add with test data', async () => {
    // Debug.enable('iplog *collection interpulse')
    const shell = await Interpulse.createCI()
    await shell.add('col1', { config: { covenant: 'collection' } })
    const actions = await shell.actions('col1')
    await actions.setTemplate({ schema, network })
    const col = await shell.latest('col1')
    const colState = col.getState().toJS()
    debug(colState)
    assert(!colState.datumTemplate.formData)
    assert(!colState.datumTemplate.network.address.formData)
    debug('adding item to collection')

    await actions.add(customerData)
    const nextColState = await shell.latest('col1')
    assert.deepEqual(nextColState.getState(), col.getState())
    const customer = await shell.latest('col1/file_00001')
    customer.getState().dir()
    assert(customer.getState().toJS().formData.firstName)
    // all covenants to respond to install events, and ignore or respond differently
    assert(!customer.getState().toJS().network.address.formData)
    const address = await shell.latest('col1/file_00001/address')
    assert(address.getState().formData.address)

    debug('adding second item to collection')
    shell.metro.enableLogging()
    await actions.add(customerData)
    const customer2 = await shell.latest('col1/file_00002')
    assert.strictEqual(
      customer2.getState().formData.firstName,
      'test firstname'
    )
    await shell.shutdown()
  })
  test('add two items concurrently to collection', async () => {
    const shell = await effectorFactory()
    await shell.add('col1', 'collection')
    const actions = await shell.actions('col1')
    const namePath = ['firstName']
    await actions.setDatumTemplate({ namePath, schema, children })

    debug('adding two customers concurrently')
    shell.metro.enableLogging()

    const customerData1 = { ...customerData, formData: { firstName: 'A' } }
    const customerData2 = { ...customerData, formData: { firstName: 'B' } }
    const await1 = actions.add(customerData1)
    const await2 = actions.add(customerData2)
    await await1
    await await2

    const customer1 = await shell.latest('col1/firstName-A')
    assert(customer1.getState().formData.firstName)
    const address = await shell.latest('col1/firstName-A/address')
    assert(address.getState().formData.address)

    const customer2 = await shell.latest('col1/firstName-B')
    assert(customer2.getState().formData.firstName)
    await shell.shutdown()
  })

  test('batch add', async () => {
    const shell = await effectorFactory()
    await shell.add('col1', 'collection')
    const actions = await shell.actions('col1')
    const namePath = ['firstName']
    await actions.setDatumTemplate({ namePath, schema, children })

    debug('batch adding customers')
    shell.metro.enableLogging({ headersOnly: true })

    const c1 = { ...customerData, formData: { custNo: 1, firstName: 'A' } }
    const c2 = { ...customerData, formData: { custNo: 2, firstName: 'B' } }
    const c3 = { ...customerData, formData: { custNo: 3, firstName: 'C' } }
    const result1 = await actions.batch([c1, c2, c3])
    const c4 = { ...customerData, formData: { custNo: 4, firstName: 'D' } }
    const c5 = { ...customerData, formData: { custNo: 5, firstName: 'E' } }
    const c6 = { ...customerData, formData: { custNo: 6, firstName: 'F' } }
    const result2 = await actions.batch([c4, c5, c6])
    await shell.metro.settle()
    debug('result', result1)
    const customer1 = await shell.latest('col1/firstName-A')
    assert(customer1.getState().formData.firstName)
    const address = await shell.latest('col1/firstName-A/address')
    assert(address.getState().formData.address)

    const customer2 = await shell.latest('col1/firstName-B')
    assert(customer2.getState().formData.firstName)
    await shell.shutdown()
  })
  test.todo('collection with initial state already set')
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
  test.todo('datum with collection child')
})
