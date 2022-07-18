import assert from 'assert-fast'
// const faker from 'faker/locale/en')
import Ajv from 'ajv'
// import AjvFormats from 'ajv-formats'
import { interchain, useBlocks } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:apps:datum')
const ajv = new Ajv({ allErrors: true, verbose: true })
// AjvFormats(ajv)
// ajv.addKeyword('faker')

// const jsf from 'json-schema-faker')
// const isBrowserBundle = !jsf.extend
// if (isBrowserBundle) {
//   Object.assign(jsf, {
//     extend: () => true,
//     option: () => true,
//     generate: () => ({}),
//   })
// }
// jsf.extend('faker', () => faker)
// jsf.option({ random: seedrandom(seed), alwaysFakeOptionals: true })
// faker.seed(seed)
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
 *  11. recheck schema is valid when merge occurs
 */

const datumSchema = {
  type: 'object',
  title: 'Datum',
  required: [
    'type', // TODO type may be replaced by covenant ?
    'namePath',
    'schema',
    'uiSchema',
    'subscribers',
    'network',
  ],
  additionalProperties: false,
  properties: {
    type: { enum: ['COLLECTION', 'XSTATE', 'ARRAY', 'DATA'] },
    isEditable: { type: 'boolean' },
    namePath: { type: 'array', items: { type: 'string' } },
    schema: { type: 'object' },
    uiSchema: { type: 'object' },
    formData: { type: 'object' },
    subscribers: {
      type: 'array',
      description: 'list of paths that need to be notified when changes occur',
      // TODO use regex for subscriber path format
      items: { type: 'string' },
    },
    // does not include formData
    network: { type: 'object', patternProperties: { '(.*?)': { $ref: '#' } } },
  },
}

const defaultDatum = {
  type: 'DATA',
  isEditable: true,
  namePath: [], // array of keys into formData
  formData: {},
  schema: {},
  uiSchema: {},
  subscribers: [],
  network: {},
}
const reducer = async (request) => {
  // TODO run assertions on state shape thru schema
  // TODO assert the children match the schema definition
  const { type, payload } = request
  assert.strictEqual(typeof payload, 'object')
  debug(`reducer: `, type)
  switch (type) {
    case '@@INIT': {
      debug(`@@INIT`)
      // TODO check state and make new children
      return
    }
    case 'SET': {
      // TODO trouble is that if change schema, need to add data at the same time
      // so makes it hard to have separate ops for schema and data changes
      if (_isTemplateIncluded(payload)) {
        state = convertToTemplate(payload)
      }
      const demuxed = demuxFormData(state, payload)
      state.formData = demuxed.formData
      if (!Object.keys(state.children).length) {
        return state
      }
      // TODO WARNING if have changed children in current block, will be stale
      // TODO handle updating what the children should be
      const awaits = []
      for (const name in state.children) {
        debug(`creating new child: `, name)
        const setChild = actions.set({
          ...demuxed.children[name],
          ...state.children[name],
        })
        debug(`setChild`, setChild)
        // TODO honour type somehow, if specify a collection ?
        const covenantId = CovenantId.create('datum')
        const spawn = dmzReducer.actions.spawn(name, { covenantId })
        interchain(spawn)
        const promise = interchain(setChild, name)
        awaits.push(promise)
      }
      await Promise.all(awaits)
      // TODO remove deleted children
      return state
    }
    default:
      debug(action)
      // throw new Error(`Unknown action: ${type}`)
      return state
  }
}
const _isTemplateIncluded = (payload) => {
  if (payload.schema && Object.keys(payload.schema).length) {
    return true
  }
  const { network = {} } = payload
  return Object.values(network).some(_isTemplateIncluded)
}

const demuxFormData = (template, payload) => {
  validateDatumTemplate(template)
  // TODO remove the mixing of setting the template and setting the data
  const unmixed = separateFormData(payload)
  validateFormData(template, unmixed)
  return unmixed
}
const separateFormData = (payload) => {
  if (!payload || typeof payload.formData === 'undefined') {
    return {}
  }
  const { formData } = payload
  const result = {}
  if (typeof formData !== 'undefined') {
    result.formData = formData
  }
  if (payload.network && Object.keys(payload.network).length) {
    result.network = {}
    for (const name in payload.network) {
      result.network[name] = separateFormData(payload.network[name])
    }
  }
  return result
}

const validateFormData = (template, payload) => {
  const isValid = ajv.validate(template.schema, payload.formData)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    debug(`error validating:`, payload)
    throw new Error(`${template.schema.title} failed validation: ${errors}`)
  }
  for (const name in template.network) {
    let data = { formData: {} }
    if (payload.network && payload.network[name]) {
      data = payload.network[name]
    }
    validateFormData(template.network[name], data)
  }
}
const _generateFakeData = (template, payload = {}) => {
  // TODO existing data overrides fake, provided data overrides existing
  const { formData = {}, network: payloadNetwork = {} } = payload
  const fake = {} // jsf.generate(template.schema)
  const inflated = { ...fake, ...formData }
  debug(`fake: `, inflated)
  const result = { ...payload, formData: inflated }

  if (Object.keys(template.network).length) {
    const network = {}
    for (const name in template.network) {
      network[name] = _generateFakeData(
        template.network[name],
        payloadNetwork[name]
      )
    }
    result.network = network
  }
  return result
}

const convertToTemplate = (datum) => {
  // TODO use existing template for things like uiSchema
  const { isTestData, ...rest } = datum
  let template = withDefaults(rest)
  template = _withoutFormData(template)
  validateDatumTemplate(template)
  _validateChildSchemas(template)
  return template
}
const validateDatumTemplate = (datumTemplate) => {
  const isValid = ajv.validate(datumSchema, datumTemplate)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Datum failed validation: ${errors}`)
  }
}
const withDefaults = (datum) => {
  const inflated = { ...defaultDatum, ...datum }
  const { network: currentNetwork } = inflated
  const network = {}
  for (const name in currentNetwork) {
    network[name] = withDefaults(currentNetwork[name])
  }
  return { ...inflated, network }
}
const _withoutFormData = (datum) => {
  const { formData, network: currentNetwork = {}, ...rest } = datum
  const network = {}
  for (const name in currentNetwork) {
    network[name] = _withoutFormData(currentNetwork[name])
  }
  return { ...rest, network }
}
const _validateChildSchemas = (datum) => {
  // compilation will throw if schemas invalid
  try {
    ajv.compile(datum.schema)
    // TODO check that datum.uiSchema is formatted correctly
    Object.values(datum.network).every(_validateChildSchemas)
  } catch (e) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Child schemas failed validation: ${errors}`)
  }
}
const muxTemplateWithFormData = (template, payload) => {
  const result = { ...template, network: {} }
  result.formData = payload.formData
  for (const name in template.network) {
    let data = { formData: {} }
    if (payload.network && payload.network[name]) {
      data = payload.network[name]
    }
    result.network[name] = muxTemplateWithFormData(template.network[name], data)
  }
  return result
}
const api = {
  set: { type: 'object', title: 'SET', description: '' },
  // subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  // unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
  // setDirectEdit: () => ({ type: 'SET_DIRECT' }), // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}

export {
  api,
  reducer,
  convertToTemplate,
  demuxFormData,
  validateDatumTemplate,
  muxTemplateWithFormData,
  validateFormData,
}
