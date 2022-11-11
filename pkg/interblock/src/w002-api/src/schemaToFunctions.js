import assert from 'assert-fast'
import Ajv from 'ajv'
const ajv = new Ajv({ allErrors: true, verbose: true, useDefaults: true })
// first compile is about 12ms, so burn it off
ajv.compile({ type: 'object' })

export const schemaToFunctions = (jsonSchema) => {
  assert.strictEqual(typeof jsonSchema, 'object')
  const actions = {}
  for (const key of Object.keys(jsonSchema)) {
    const schema = jsonSchema[key]
    const type = schema.title || key
    const action = createAction(type, schema)
    action.schema = schema
    actions[key] = action
  }
  return actions
}
const createAction = (type, schema) => {
  const validate = ajv.compile(schema)
  return (payload, ...rest) => {
    // TODO set function parameter names
    const isObject = typeof payload === 'object'
    if (!isObject || rest.length) {
      rest.unshift(payload)
      payload = {}
      const { properties = {} } = schema
      for (const key of Object.keys(properties)) {
        const value = rest.shift()
        if (value === undefined) {
          break
        }
        payload[key] = value
      }
    }
    if (!validate(payload)) {
      const { errors = [] } = validate
      let concat = ''
      errors.forEach(({ message }) => {
        if (concat) {
          concat += ', '
        }
        concat += message
      })
      throw type + ': ' + concat
    }
    return { type, payload }
  }
}
