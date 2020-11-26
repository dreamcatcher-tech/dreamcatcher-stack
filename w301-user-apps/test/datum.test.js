const assert = require('assert')
const { effectorFactory } = require('../..')
const debug = require('debug')('crm:tests:datum')
const { datum } = require('../src/datum')

require('debug').enable('*met* *tests* *datum')

const schema = {
  title: 'Customer',
  type: 'object',
  required: ['firstName'],
  properties: {
    firstName: { type: 'string' },
  },
}

describe('datum', () => {
  test('simple datum with test data', async () => {
    const root = await effectorFactory('datum', { datum })
    await root.add('datum1', 'datum')
    root.enableLogging()
    await root.datum1.set({ schema, isTestData: true })

    const { state } = root.datum1.getState()
    debug(`state: `, state)
    assert.deepStrictEqual(
      Object.keys(state.formData),
      Object.keys(schema.properties)
    )
    assert.deepStrictEqual(state.schema, schema)
    await root.settle()
  })
  test('nested datums with test data', async () => {
    // make a customer, and show the data being broken up automatically to childrenconst root = await effectorFactory('datum', { datum })
    const root = await effectorFactory('nested', { datum })
    await root.add('datum1', 'datum')
    root.enableLogging()
    const address = {
      schema: {
        title: 'Address',
        type: 'object',
        properties: { address: { type: 'string' } },
      },
    }
    const children = { address }

    await root.datum1.set({ schema, isTestData: true, children })

    const { state: datum1 } = root.datum1.getState()
    debug(`datum1: `, datum1)
    const { state } = root.datum1.address.getState()
    debug(`address: `, state)

    await root.settle()
  })
  test('updates data', () => {})
  test.todo('create a datum with genesis state and schema')
  test('invalid data throws', () => {})
  test('invalid initial state throws', () => {})
  test('missing required fields throws', () => {})
  test.todo('child throws during creation')
})
