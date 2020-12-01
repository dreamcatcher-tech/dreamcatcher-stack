const assert = require('assert')
const faker = require('faker')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true, verbose: true })
const debug = require('debug')('interblock:apps:datum')
const dmzReducer = require('../../w021-dmz-reducer')
const { interchain } = require('../../w002-api')
/**
 * Requirements:
 *  1.  boot with state already set, and this gets checked for validity immediately
 *  2.  change schema and data at atomically
 *  3.  upgrade the schema
 *  4.  have children, which can be set as a single top level action, or individually
 *  5.  children that have schema updated too
 *  6.  expose a name path which is used to name the datum based on its data, eg customerId
 *  7.  notify subscribers when changes occur
 *  8.  be simulateable in a parent, to know if it or its children will throw before creation
 *  9.  provide use supplied mappings to faker data so it can generate mock data easily
 *  10. a tree of datums should update atomically from parent - all or none
 */

const datumSchema = {
  type: 'object',
  title: 'Datum',
  required: [
    'type',
    'namePath',
    'schema',
    'uiSchema',
    'subscribers',
    'children',
  ],
  additionalProperties: false,
  properties: {
    type: { enum: ['COLLECTION', 'XSTATE', 'ARRAY', 'DATA'] },
    isEditable: { type: 'boolean' },
    namePath: { type: 'array', items: { type: 'string' } },
    formData: { type: 'object' },
    schema: { type: 'object' },
    uiSchema: { type: 'object' },
    subscribers: {
      type: 'array',
      description: 'list of paths that need to be notified when changes occur',
      // TODO use regex for subscriber path format
      items: { type: 'string' },
    },
    // does not include formData
    children: { type: 'object', patternProperties: { '(.*?)': { $ref: '#' } } },
  },
}

const initialState = {
  type: 'DATA',
  isEditable: true,
  namePath: [], // array of keys into formData
  formData: {},
  schema: {},
  uiSchema: {},
  subscribers: [],
  children: {},
}
const reducer = async (state, action) => {
  // TODO run assertions on state shape
  if (!Object.keys(state).length) {
    state = initialState
  }
  const { type, payload } = action
  switch (type) {
    case '@@INIT': {
      // if made from scratch, check state and make new children
      debug(`@@INIT`)
      break
    }
    case 'SET': {
      if (_isTemplateIncluded(payload)) {
        state = convertToTemplate(payload)
      }
      if (payload.isTestData) {
        const hash = action.getHash()
        const seed = parseInt(Number('0x' + hash.substring(0, 14)))
        faker.seed(seed)
      }
      const demuxed = demuxFormData(state, payload)
      state.formData = demuxed.formData
      if (Object.keys(state.children).length) {
        const { children } = await interchain(dmzReducer.actions.listChildren())
        for (const name in state.children) {
          if (!children[name]) {
            debug(`creating new child: `, name)
            const setChild = actions.set({
              ...demuxed.children[name],
              ...state.children[name],
            })
            const spawn = dmzReducer.actions.spawn(name)
            interchain(spawn)
            await interchain(setChild, name)
          }
        }
      }
      return state
    }
    default:
      throw new Error(`Unknown action: ${type}`)
  }
}
const _isTemplateIncluded = (payload) => {
  if (payload.schema && Object.keys(payload.schema).length) {
    return true
  }
  const { children = {} } = payload
  return Object.values(children).some(_isTemplateIncluded)
}

const demuxFormData = (template, payload) => {
  _validateDatumTemplate(template)

  const { isTestData, ...rest } = payload
  let unmixed = _separateFormData(rest)
  if (isTestData) {
    // make fakes for current and all children
    unmixed = _generateFakeData(template, unmixed)
  }
  _validateFormData(template, unmixed)
  return unmixed
}
const _separateFormData = (payload) => {
  if (!payload || typeof payload.formData === undefined) {
    return {}
  }
  const { formData } = payload
  const result = { formData }
  if (payload.children && Object.keys(payload.children).length) {
    result.children = {}
    for (const name in payload.children) {
      result.children[name] = _separateFormData(payload.children[name])
    }
  }
  return result
}

const _validateFormData = (template, payload) => {
  const isValid = ajv.validate(template.schema, payload.formData)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`${template.schema.title} failed validation: ${errors}`)
  }
  for (const name in template.children) {
    _validateFormData(template.children[name], payload.children[name])
  }
}
const _generateFakeData = (template, payload = {}) => {
  // TODO existing data overrides fake, provided data overrides existing
  const { formData = {}, children: payloadChildren = {} } = payload
  Object.keys(template.schema.properties).forEach((key) => {
    if (formData[key]) {
      return
    }
    switch (key) {
      // TODO if no faker key, switch to random strings
      case 'firstName':
        formData[key] = faker.name.firstName()
        break
      case 'address':
        formData[key] = faker.address.streetAddress()
        break
    }
  })
  const result = { ...payload, formData }
  if (Object.keys(template.children).length) {
    const children = {}
    for (const name in template.children) {
      children[name] = _generateFakeData(
        template.children[name],
        payloadChildren[name]
      )
    }
    result.children = children
  }
  return result
}

const convertToTemplate = (datum) => {
  // TODO use existing template for things like uiSchema
  const { isTestData, ...rest } = datum
  let template = _withDefaults(rest)
  template = _withoutFormData(template)
  _validateDatumTemplate(template)
  _validateChildSchemas(template)
  return template
}
const _validateDatumTemplate = (datum) => {
  const isValid = ajv.validate(datumSchema, datum)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Datum failed validation: ${errors}`)
  }
}
const _withDefaults = (datum) => {
  const inflated = { ...initialState, ...datum }
  const { children: currentChildren } = inflated
  const children = {}
  for (const name in currentChildren) {
    children[name] = _withDefaults(currentChildren[name])
  }
  return { ...inflated, children }
}
const _withoutFormData = (datum) => {
  const { formData, children: currentChildren = {}, ...rest } = datum
  const children = {}
  for (const name in currentChildren) {
    children[name] = _withoutFormData(currentChildren[name])
  }
  return { ...rest, children }
}
const _validateChildSchemas = (datum) => {
  // compilation will throw if schemas invalid
  const schemaCompiled = ajv.compile(datum.schema)
  const uiSchemaCompiled = ajv.compile(datum.uiSchema)
  Object.values(datum.children).every(_validateChildSchemas)
}

const actions = {
  // create is handled by init ?
  set: (payload) => ({ type: 'SET', payload }),
  subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
  setDirectEdit: () => ({ type: 'SET_DIRECT' }), // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}

const datum = { actions, reducer, covenantId: { name: 'datum' } }
module.exports = { datum, convertToTemplate, unmixFormData: demuxFormData }
