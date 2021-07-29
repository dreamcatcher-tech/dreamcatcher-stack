import assert from 'assert'
import { effectorFactory } from '../../index'
import { convertToTemplate, demuxFormData } from '../src/datum'
import Debug from 'debug'
const debug = Debug('crm:tests:datum')

const schema = {
  title: 'Customer',
  type: 'object',
  required: ['firstName'],
  additionalProperties: false,
  properties: {
    firstName: { type: 'string', faker: 'name.firstName' },
  },
}
const address = {
  schema: {
    title: 'Address',
    type: 'object',
    additionalProperties: false,
    properties: {
      address: { type: 'string', faker: 'address.streetAddress' },
    },
  },
}
describe.skip('datum helper functions', () => {
  describe('convertToTemplate', () => {
    const action = {
      type: 'FAKE',
      payload: { isTestData: true },
      getHash: () => '',
    }
    test('basic', () => {
      const template = convertToTemplate({ schema })
      const payload = demuxFormData(template, action)
      assert.strictEqual(typeof payload.formData.firstName, 'string')
      assert(!payload.isTestData)
    })
    test('nested', () => {
      const children = { address }
      const template = convertToTemplate({ schema, children })
      assert(template.children.address)
      const payload = demuxFormData(template, action)
      assert(payload.formData.firstName)
      assert(payload.children.address.formData)
      assert(!payload.children.address.children)
    })
    test.todo('nested formData')
  })
  describe('demuxFormData', () => {})
})

describe.skip('datum', () => {
  test('simple datum with test data', async () => {
    const root = await effectorFactory('datum')
    await root.add('datum1', 'datum')
    root.metro.enableLogging()
    const latest = await root.latest('datum1')
    assert.strictEqual(latest.covenantId.name, 'datum')
    const actions = await root.actions('datum1')
    await actions.set({ schema, isTestData: true })

    const { state } = await root.latest('datum1')
    assert.deepStrictEqual(
      Object.keys(state.formData),
      Object.keys(schema.properties)
    )
    assert.deepStrictEqual(state.schema, schema)
    await root.metro.settle()
  })
  test('nested datums with test data', async () => {
    // make a customer, and show the data being broken up automatically to childrenconst root = await effectorFactory('datum', { datum })
    const root = await effectorFactory('nested')
    await root.add('datum1', 'datum')
    root.metro.enableLogging()

    const children = { address }
    const actions = await root.actions('datum1')
    await actions.set({ schema, isTestData: true, children })
    const { state: datum1 } = await root.latest('datum1')
    assert.deepStrictEqual(datum1.schema, schema)
    assert.deepStrictEqual(datum1.children.address.schema, address.schema)
    assert(datum1.formData.firstName)
    assert(!datum1.children.address.formData)

    const { state: address1 } = await root.latest('datum1/address')
    assert.deepStrictEqual(address1.schema, address.schema)
    assert(address1.formData.address)
    assert(!Object.keys(address1.children).length)

    await root.metro.settle()
  })
  test('nested datums with optional extra test data', async () => {
    const root = await effectorFactory('nested')
    await root.add('datum1', 'datum')
    root.metro.enableLogging()

    const extraAddress = { schema: { ...address.schema } }
    delete extraAddress.schema.additionalProperties
    debug(`extraAddress`, extraAddress)
    const children = { address: extraAddress }
    const { additionalProperties, ...extraSchema } = schema
    debug(`extraSchema`, extraSchema)
    const actions = await root.actions('datum1')
    await actions.set({ schema: extraSchema, isTestData: true, children })
    const { state: datum1 } = await root.latest('datum1')
    assert.deepStrictEqual(datum1.schema, extraSchema)
    assert.deepStrictEqual(datum1.children.address.schema, extraAddress.schema)
    assert(datum1.formData.firstName)
    assert(!datum1.children.address.formData)

    const { state: address1 } = await root.latest('datum1/address')
    assert.deepStrictEqual(address1.schema, extraAddress.schema)
    debug(address1.formData)
    assert(address1.formData.address)
    assert(!Object.keys(address1.children).length)

    await root.metro.settle()
  })
  test.todo('updates data')
  test.todo('create a datum with genesis state and schema')
  test.todo('invalid data throws')
  test.todo('invalid initial state throws')
  test.todo('missing required fields throws')
  test.todo('child throws during creation')
  test.todo('nested child throws if schema cannot compile')
  test.todo('invalid formdata of children detected before creating child')
  test.todo('datum removes children causes chain deletion')
  test.todo('update deletes children via omission')
  test.todo('datum updates across children are atomic')
})
