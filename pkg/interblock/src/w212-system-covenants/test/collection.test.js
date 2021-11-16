import { assert } from 'chai/index.mjs'
import { effectorFactory } from '../../index.mjs'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('crm:tests:collection')
Debug.enable()

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

    debug('batch adding customers')
    shell.metro.enableLogging()
    Debug.enable('*met* *collection')

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
    const { state: customer1 } = await shell.latest('col1/firstName-A')
    assert(customer1.formData.firstName)
    const { state: address } = await shell.latest('col1/firstName-A/address')
    assert(address.formData.address)

    const { state: customer2 } = await shell.latest('col1/firstName-B')
    assert(customer2.formData.firstName)
  })
  test.todo('collection with initial state already set')
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
  test.todo('datum with collection child')
})
