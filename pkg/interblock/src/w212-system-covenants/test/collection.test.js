import { assert } from 'chai/index.mjs'
import { effectorFactory } from '../../index.mjs'
import Debug from 'debug'
const debug = Debug('crm:tests:collection')
Debug.enable('*met* *tests*')

describe('collection', () => {
  const schema = {
    title: 'Customer',
    type: 'object',
    required: ['firstName'],
    properties: {
      firstName: { type: 'string' },
    },
  }
  const children = {
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
    children: { address: { formData: { address: 'test address' } } },
  }

  test('add with test data', async () => {
    const shell = await effectorFactory('c')
    await shell.add('col1', 'collection')
    const actions = await shell.actions('col1')
    await actions.setDatumTemplate({ schema, children })
    const { state: colState } = await shell.latest('col1')
    assert(!colState.datumTemplate.formData)
    assert(!colState.datumTemplate.children.address.formData)
    debug('adding item to collection')

    await actions.add(customerData)
    const { state: nextColState } = await shell.latest('col1')
    assert.deepEqual(nextColState, colState)
    const { state: customer } = await shell.latest('col1/file_00001')
    assert(customer.formData.firstName)
    assert(!customer.children.address.formData)
    const { state: address } = await shell.latest('col1/file_00001/address')
    assert(address.formData.address)

    debug('adding second item to collection')
    shell.metro.enableLogging()
    await actions.add(customerData)
    const { state: secondCustomer } = await shell.latest('col1/file_00002')
    assert.strictEqual(secondCustomer.formData.firstName, 'test firstname')

    await shell.metro.settle()
  })
  test('add two items concurrently to collection', async () => {
    const shell = await effectorFactory('c')
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

    const { state: customer1 } = await shell.latest('col1/firstName-A')
    assert(customer1.formData.firstName)
    const { state: address } = await shell.latest('col1/firstName-A/address')
    assert(address.formData.address)

    const { state: customer2 } = await shell.latest('col1/firstName-B')
    assert(customer2.formData.firstName)

    await shell.metro.settle()
  })
  test('batch add', async () => {
    const shell = await effectorFactory('c')
    await shell.add('col1', 'collection')
    const actions = await shell.actions('col1')
    const namePath = ['firstName']
    await actions.setDatumTemplate({ namePath, schema, children })

    debug('batch adding two customers')
    shell.metro.enableLogging()
    const customerData1 = { ...customerData, formData: { firstName: 'A' } }
    const customerData2 = { ...customerData, formData: { firstName: 'B' } }
    const result = await actions.batch([customerData1, customerData2])
    debug('result', result)
    const { state: customer1 } = await shell.latest('col1/firstName-A')
    assert(customer1.formData.firstName)
    const { state: address } = await shell.latest('col1/firstName-A/address')
    assert(address.formData.address)

    const { state: customer2 } = await shell.latest('col1/firstName-B')
    assert(customer2.formData.firstName)

    await shell.metro.settle()
  })
  test.todo('collection with initial state already set')
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
  test.todo('datum with collection child')
})
