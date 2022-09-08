import { assert } from 'chai/index.mjs'
import { convertToTemplate } from '../src/datum'
import Debug from 'debug'
import { Interpulse } from '../..'
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
    }
    test('basic', () => {
      const template = convertToTemplate({ schema })
      const payload = 'todo'
      assert.strictEqual(typeof payload.formData.firstName, 'string')
      assert(!payload.isTestData)
    })
    test('nested', () => {
      const children = { address }
      const template = convertToTemplate({ schema, children })
      assert(template.children.address)
      const payload = 'todo'
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
    const engine = await Interpulse.createCI()
    await engine.add('datum1', 'datum')
    engine.metro.enableLogging()
    const latest = await engine.latest('datum1')
    assert.strictEqual(latest.covenantId.name, 'datum')
    const actions = await engine.actions('datum1')
    await actions.set({ schema, isTestData: true })

    const { state } = await engine.latest('datum1')
    assert.deepEqual(
      Object.keys(state.formData),
      Object.keys(schema.properties)
    )
    assert.deepEqual(state.schema, schema)
  })
  test('nested datums with test data', async () => {
    // make a customer, and show the data being broken up automatically to childrenconst root = await effectorFactory('datum', { datum })
    const engine = await Interpulse.createCI()
    await engine.add('datum1', 'datum')

    const children = { address }
    const actions = await engine.actions('datum1')
    await actions.set({ schema, isTestData: true, children })
    const { state: datum1 } = await engine.latest('datum1')
    assert.deepEqual(datum1.schema, schema)
    assert.deepEqual(datum1.children.address.schema, address.schema)
    assert(datum1.formData.firstName)
    assert(!datum1.children.address.formData)

    const { state: address1 } = await engine.latest('datum1/address')
    assert.deepEqual(address1.schema, address.schema)
    assert(address1.formData.address)
    assert(!Object.keys(address1.children).length)
  })
  test('nested datums with optional extra test data', async () => {
    const engine = await Interpulse.createCI()
    await engine.add('datum1', 'datum')

    const extraAddress = { schema: { ...address.schema } }
    delete extraAddress.schema.additionalProperties
    debug(`extraAddress`, extraAddress)
    const children = { address: extraAddress }
    const { additionalProperties, ...extraSchema } = schema
    debug(`extraSchema`, extraSchema)
    const actions = await engine.actions('datum1')
    await actions.set({ schema: extraSchema, isTestData: true, children })
    const { state: datum1 } = await engine.latest('datum1')
    assert.deepEqual(datum1.schema, extraSchema)
    assert.deepEqual(datum1.children.address.schema, extraAddress.schema)
    assert(datum1.formData.firstName)
    assert(!datum1.children.address.formData)

    const { state: address1 } = await engine.latest('datum1/address')
    assert.deepEqual(address1.schema, extraAddress.schema)
    debug(address1.formData)
    assert(address1.formData.address)
    assert(!Object.keys(address1.children).length)
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
