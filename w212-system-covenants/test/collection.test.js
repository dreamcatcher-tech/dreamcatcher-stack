const assert = require('assert')
const { effectorFactory } = require('../../index')
const debug = require('debug')('crm:tests:collection')

require('debug').enable()

describe('collection', () => {
  test('add with test data', async () => {
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

    const root = await effectorFactory('col')
    root.metro.enableLogging()
    await root.add('col1', 'collection')
    const col1Actions = await root.actions('col1')
    await col1Actions.setDatumTemplate({ schema, children })
    const { state: col1State } = await root.latest('col1')
    assert(!col1State.datumTemplate.formData)
    assert(!col1State.datumTemplate.children.address.formData)

    await col1Actions.add({ isTestData: true })
    const { state } = await root.latest('col1')
    assert.deepStrictEqual(state, col1State)
    const { state: customer } = await root.latest('col1/file_00001')
    assert(customer.formData.firstName)
    assert(!customer.children.address.formData)
    const { state: address } = await root.latest('col1/file_00001/address')
    assert(address.formData.address)
    await root.metro.settle()
  })
  test.todo('collection with initial state already set')
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
})
