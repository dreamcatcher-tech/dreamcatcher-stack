const assert = require('assert')
const { effectorFactory } = require('../..')
const debug = require('debug')('crm:tests:datum')

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
    await root.add('col1', 'collection')
    root.enableLogging()
    await root.col1.setDatumTemplate({ schema, children })
    const { state: col1 } = root.col1.getState()
    assert(!col1.datumTemplate.formData)
    assert(!col1.datumTemplate.children.address.formData)

    await root.col1.add({ isTestData: true })
    const { state } = root.col1.getState()
    assert.deepStrictEqual(state, col1)
    const { state: customer } = root.col1.file_00001.getState()
    assert(customer.formData.firstName)
    assert(!customer.children.address.formData)
    const { state: address } = root.col1.file_00001.address.getState()
    assert(address.formData.address)
    await root.settle()
  })
  test.todo('reject add with key already assigned')
  test.todo('collection of collections')
})
