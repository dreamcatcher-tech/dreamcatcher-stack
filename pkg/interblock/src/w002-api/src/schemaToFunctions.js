import assert from 'assert-fast'
import Ajv from 'ajv'
import AjvFormats from 'ajv-formats'
import Debug from 'debug'
const debug = Debug('interblock:api:schemaToFunctions')

let _ajv
export const loadAjv = () => {
  if (!_ajv) {
    _ajv = new Ajv({ useDefaults: true, allErrors: true })
    AjvFormats(_ajv)
  }
  return _ajv
}

export const schemaToFunctions = (jsonSchema) => {
  assert.strictEqual(typeof jsonSchema, 'object')
  const actions = {}
  for (const fnName of Object.keys(jsonSchema)) {
    const schema = jsonSchema[fnName]
    const type = schema.title || fnName
    const action = createAction(fnName, type, schema)
    action.schema = schema
    actions[fnName] = action
  }
  return actions
}
const createAction = (fnName, type, schema) => {
  const ajv = loadAjv()
  const validate = ajv.compile(schema)
  return (payload, ...rest) => {
    // TODO set function parameter names
    const isObject = typeof payload === 'object' && !Array.isArray(payload)
    if (!isObject || rest.length) {
      rest.unshift(payload)
      payload = {}
      const { properties = {} } = schema
      // TODO prioritize the required fields as being supplied first
      for (const key of Object.keys(properties)) {
        const value = rest.shift()
        if (value === undefined) {
          break
        }
        payload[key] = value
      }
    }
    debug('payload: %O', payload)
    if (!validate(payload)) {
      throwIfNotValid(validate.errors, fnName)
    }
    return { type, payload }
  }
}
export const throwIfNotValid = (ajvErrors, fnName) => {
  if (!ajvErrors) {
    return
  }
  assert(Array.isArray(ajvErrors))
  const reasons = ajvErrors
    .map((obj) => JSON.stringify(obj, null, '  '))
    .join('\n')
  const error = new Error(
    `Parameters Validation Error for: ${fnName}: \n${reasons}`
  )
  throw error
}
