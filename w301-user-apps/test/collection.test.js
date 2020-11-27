const assert = require('assert')
const { effectorFactory } = require('../..')
const debug = require('debug')('crm:tests:datum')
const { datum } = require('../src/datum')
const { collection } = require('../src/collection')

require('debug').enable('*met* *tests* *datum *collection')

describe('collection', () => {
  test('add with test data', async () => {
    const schema = {
      customer: {
        title: 'Customer',
        type: 'object',
        required: ['firstName'],
        properties: {
          firstName: { type: 'string' },
        },
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

    const root = await effectorFactory('col', { datum, collection })
    await root.add('collection1', 'collection')
    root.enableLogging()
    await root.collection1.setSchema(schema, children)
    await root.collection1.add({ isTestData: true })

    const { state } = root.collection1.getState()
    debug(`state: `, state)
    assert.deepStrictEqual(
      Object.keys(state.formData),
      Object.keys(schema.properties)
    )
    assert.deepStrictEqual(state.schema, schema)
    await root.settle()
  })
  test.todo('reject add with key already assigned')
})
