const assert = require('assert')
const debug = require('debug')('interblock:models:modelInflator')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true, verbose: true })
const { registry } = require('./registry')

const modelInflator = (schema, instance) => {
  if (schema.title === 'State') {
    const { actions } = instance
    if (actions) {
      assert(Array.isArray(actions))
      assert(
        actions.every((action) => action.getAction || action.getContinuation)
      )
    }
    return { ...instance }
  }
  //   assert(schema.title, `only titled schemas can be inflated`)
  if (schema.patternProperties) {
    return inflatePattern(schema, instance)
  }

  assert(isKeysValidated(schema, instance), `Keys do not match`)
  const inflated = {}
  const { properties } = schema
  Object.keys(instance).map((key) => {
    const { title, type, patternProperties } = properties[key]
    const slice = instance[key]
    if (registry.isRegistered(title)) {
      inflated[key] = registry.get(title).clone(slice)
      return
    }
    if (type === 'array') {
      inflated[key] = inflateArray(properties[key], slice)
      return
    }
    if (patternProperties) {
      inflated[key] = inflatePattern(properties[key], slice)
      return
    }
    validate(properties[key], slice)
    inflated[key] = slice
  })
  return inflated
}

const inflatePattern = (schema, instance) => {
  assert(schema.type === 'object')
  assert(schema.patternProperties)
  assert(!schema.additionalProperties)
  assert.equal(Object.keys(schema.patternProperties).length, 1)
  // check min and max
  const regex = Object.keys(schema.patternProperties)[0]
  const isIntegerRegex = regex === '[0-9]*'
  const isCharRegex = regex === '(.*?)'
  const modelSchema = schema.patternProperties[regex]
  const model = registry.get(modelSchema.title)
  assert(model, `patternProperties must use models for values`)

  const inflated = {}
  Object.keys(instance).map((key) => {
    if (isIntegerRegex) {
      const int = parseInt(key)
      assert(Number.isInteger(int), `${key} is not number: ${int}`)
    }
    // TODO detect non chars at speed ?
    inflated[key] = model.clone(instance[key])
  })
  return inflated
}

const inflateArray = (schema, instance) => {
  assert(Array.isArray(instance))
  assert(schema.type === 'array')
  assert(schema.uniqueItems, `uniqueItems not set: ${schema.title}`)
  const model = registry.get(schema.items.title)
  assert(model, `Arrays must be models`)
  // check the min and unique items props
  return instance.map(model.clone)
}

const isKeysValidated = (schema, instance) => {
  assert.equal(schema.additionalProperties, false)
  const instanceKeys = Object.keys(instance)
  const propKeys = Object.keys(schema.properties)
  const isRequired = schema.required.every((key) => instanceKeys.includes(key))
  assert(isRequired)
  assert(instanceKeys.every((key) => propKeys.includes(key)))
  return true
}

const schemaMap = new WeakMap()
const validate = (schema, instance) => {
  let validator = schemaMap.get(schema)
  if (!validator) {
    try {
      validator = ajv.compile(schema)
      schemaMap.set(schema, validator)
    } catch (e) {
      const msg = `Compilation failed: ${schema && schema.title} ${e.message}`
      throw new Error(msg)
    }
  }
  const isValid = validator(instance)
  const errors = ajv.errorsText(validator.errors)
  if (!isValid) {
    throw new Error(`${schema.title} failed validation: ${errors}`)
  }
}

module.exports = { modelInflator }
