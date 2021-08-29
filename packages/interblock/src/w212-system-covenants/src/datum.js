import { assert } from 'chai/index.mjs'
// const faker from 'faker/locale/en')
import Ajv from 'ajv'
import AjvFormats from 'ajv-formats'
import * as dmzReducer from '../../w021-dmz-reducer'
import { covenantIdModel } from '../../w015-models'
import { interchain, useBlocks } from '../../w002-api'
import seedrandom from 'seedrandom'
import Debug from 'debug'
const debug = Debug('interblock:apps:datum')
const ajv = new Ajv({ allErrors: true, verbose: true })
AjvFormats(ajv)
ajv.addKeyword('faker')

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

const defaultDatum = {
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
  // TODO run assertions on state shape thru schema
  // TODO assert the children match the schema definition
  if (!Object.keys(state).length) {
    state = defaultDatum
  }
  const { type, payload } = action
  debug(`action: `, type)
  switch (type) {
    case '@@INIT': {
      debug(`@@INIT`)
      // TODO check state and make new children
      return state
    }
    case 'SET': {
      // TODO trouble is that if change schema, need to add data at the same time
      // so makes it hard to have separate ops for schema and data changes
      if (_isTemplateIncluded(payload)) {
        state = convertToTemplate(payload)
      }
      const demuxed = demuxFormData(state, action)
      state.formData = demuxed.formData
      if (Object.keys(state.children).length) {
        // TODO WARNING if have changed children in current block, will be stale
        const latest = await useBlocks()
        const children = dmzReducer.listChildren(latest)
        for (const name in state.children) {
          if (!children[name]) {
            debug(`creating new child: `, name)
            const setChild = actions.set({
              ...demuxed.children[name],
              ...state.children[name],
            })
            debug(`setChild`, setChild)
            // TODO honour type somehow, if specify a collection ?
            const covenantId = covenantIdModel.create('datum')
            const spawn = dmzReducer.actions.spawn(name, { covenantId })
            interchain(spawn)
            await interchain(setChild, name)
          }
        }
        // TODO remove deleted children
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

const demuxFormData = (template, action) => {
  const { payload } = action
  if (payload.isTestData) {
    const hash = action.getHash()
    const seed = parseInt(Number('0x' + hash.substring(0, 14)))
    debug(`seed: `, seed)
    // jsf.option({ random: seedrandom(seed), alwaysFakeOptionals: true })
    // faker.seed(seed)
  }
  validateDatumTemplate(template)

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
  if (!payload || typeof payload.formData === 'undefined') {
    return {}
  }
  const { formData } = payload
  const result = {}
  if (typeof formData !== 'undefined') {
    result.formData = formData
  }
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
  const fake = {} // jsf.generate(template.schema)
  const inflated = { ...fake, ...formData }
  debug(`fake: `, inflated)
  const result = { ...payload, formData: inflated }

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
  validateDatumTemplate(template)
  _validateChildSchemas(template)
  return template
}
const validateDatumTemplate = (datum) => {
  const isValid = ajv.validate(datumSchema, datum)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Datum failed validation: ${errors}`)
  }
}
const _withDefaults = (datum) => {
  const inflated = { ...defaultDatum, ...datum }
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
  try {
    ajv.compile(datum.schema)
    // TODO check that datum.uiSchema is formatted correctly
    Object.values(datum.children).every(_validateChildSchemas)
  } catch (e) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Child schemas failed validation: ${errors}`)
  }
}
const muxTemplateWithFormData = (template, payload) => {
  const result = { ...template, children: {} }
  result.formData = payload.formData
  for (const name in template.children) {
    result.children[name] = muxTemplateWithFormData(
      template.children[name],
      payload.children[name]
    )
  }
  return result
}
const actions = {
  // create is handled by init ?
  set: (payload) => ({ type: 'SET', payload }),
  subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
  setDirectEdit: () => ({ type: 'SET_DIRECT' }), // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}
const covenantId = covenantIdModel.create('datum')

export {
  actions,
  reducer,
  convertToTemplate,
  demuxFormData,
  validateDatumTemplate,
  muxTemplateWithFormData,
  covenantId,
}
