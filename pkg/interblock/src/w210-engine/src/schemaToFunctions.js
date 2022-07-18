import assert from 'assert-fast'
import Ajv from 'ajv'
const ajv = new Ajv({ allErrors: true, verbose: true })
ajv.compile({ type: 'object' }) // first compile is about 12ms, so burn it off

export const schemaToFunctions = (jsonSchema) => {
  assert.strictEqual(typeof jsonSchema, 'object')
  const actions = {}
  for (const key of Object.keys(jsonSchema)) {
    const schema = jsonSchema[key]
    const type = schema.title || key
    const action = createAction(type, schema)
    actions[key] = action
  }
  return actions
}
const createAction = (type, schema) => {
  const validate = ajv.compile(schema)
  return (payload = {}) => {
    if (!validate(payload)) {
      throw validate.errors
    }
    return { type, payload }
  }
}
