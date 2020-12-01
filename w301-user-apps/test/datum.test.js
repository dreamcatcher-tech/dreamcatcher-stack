const assert = require('assert')
const { effectorFactory } = require('../..')
const debug = require('debug')('crm:tests:datum')
const { datum, convertToTemplate, unmixFormData } = require('../src/datum')

require('debug').enable('*met* *tests* *datum')

const schema = {
  title: 'Customer',
  type: 'object',
  required: ['firstName'],
  properties: {
    firstName: { type: 'string' },
  },
}
describe('datum helper functions', () => {
  describe('convertToTemplate', () => {
    test('basic', () => {
      const template = convertToTemplate({ schema })
      const barePayload = { isTestData: true }
      const payload = unmixFormData(template, barePayload)
      assert.strictEqual(typeof payload.formData.firstName, 'string')
      assert(!payload.isTestData)
    })
    test('nested', () => {
      const address = {
        schema: {
          title: 'Address',
          type: 'object',
          properties: { address: { type: 'string' } },
        },
      }
      const children = { address }
      const template = convertToTemplate({ schema, children })
      assert(template.children.address)
      const barePayload = { isTestData: true }
      const payload = unmixFormData(template, barePayload)
      assert(payload.formData.firstName)
      assert(payload.children.address.formData)
      assert(!payload.children.address.children)
    })
    test.todo('nested formData')
  })
  describe('unmixFormData', () => {})
})

describe('datum', () => {
  test('simple datum with test data', async () => {
    const root = await effectorFactory('datum', { datum })
    await root.add('datum1', 'datum')
    root.enableLogging()
    await root.datum1.set({ schema, isTestData: true })

    const { state } = root.datum1.getState()
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
    assert.deepStrictEqual(datum1.schema, schema)
    assert.deepStrictEqual(datum1.children.address.schema, address.schema)
    assert(datum1.formData.firstName)
    assert(!datum1.children.address.formData)

    const { state: address1 } = root.datum1.address.getState()
    assert.deepStrictEqual(address1.schema, address.schema)
    assert(address1.formData.address)
    assert(!Object.keys(address1.children).length)

    await root.settle()
  })
  test('updates data', () => {})
  test.todo('create a datum with genesis state and schema')
  test('invalid data throws', () => {})
  test('invalid initial state throws', () => {})
  test('missing required fields throws', () => {})
  test.todo('child throws during creation')
  test.todo('nested child throws if schema cannot compile')
  test.todo('invalid formdata of children detected before creating child')
  test.todo('datum removes children causes chain deletion')
  test.todo('update deletes children via omission')
  test.todo('datum updates across children are atomic')
})
