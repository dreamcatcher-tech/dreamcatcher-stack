import assert from 'assert-fast'
// const faker from 'faker/locale/en')
import Ajv from 'ajv'
import AjvFormats from 'ajv-formats'
import { interchain, useState } from '../../w002-api'
import Debug from 'debug'
import { Request } from '../../w008-ipld'
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
  required: ['type', 'schema'],
  additionalProperties: false,
  properties: {
    type: { enum: ['COLLECTION', 'XSTATE', 'ARRAY', 'DATUM'] },
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
    // TODO check schema if covenant type is 'datum'
    network: { type: 'object' },
  },
}

const reducer = async (request) => {
  // TODO run assertions on state shape thru schema
  // TODO assert the children match the schema definition
  const { type, payload } = request
  assert.strictEqual(typeof payload, 'object')
  debug(`reducer: `, type)
  let [state, setState] = await useState()
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
      state.formData = payload.formData
      if (!Object.keys(state.children).length) {
        return
      }
      // TODO WARNING if have changed children in current block, will be stale
      // TODO handle updating what the children should be
      const awaits = []
      for (const name in state.children) {
        debug(`creating new child: `, name)
        // const setChild = actions.set({
        //   ...demuxed.children[name],
        //   ...state.children[name],
        // })
        // debug(`setChild`, setChild)
        // TODO honour type somehow, if specify a collection ?
        const spawn = Request.spawn(name, { covenant: 'datum' })
        interchain(spawn)
        // const promise = interchain(setChild, name)
        // awaits.push(promise)
      }
      await Promise.all(awaits)
      // TODO remove deleted children
      return
    }
    default:
      debug(request)
      throw new Error(`Unknown action: ${type}`)
  }
}
const _isTemplateIncluded = (payload) => {
  if (payload.schema && Object.keys(payload.schema).length) {
    return true
  }
  const { network = {} } = payload
  return Object.values(network).some(_isTemplateIncluded)
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

const validateFormData = (payload, template) => {
  const isValid = ajv.validate(template.schema, payload.formData)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    debug(`error validating:`, payload)
    throw new Error(`${template.schema.title} failed validation: ${errors}`)
  }
  if (!template.network) {
    return
  }
  for (const name in template.network) {
    const child = template.network[name]
    if (child.covenant !== 'datum') {
      continue
    }
    let data = { formData: {} }
    if (payload.network && payload.network[name]) {
      data = payload.network[name]
    }
    validateFormData(data, child.state)
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

const convertToTemplate = (template) => {
  // TODO use existing template for things like uiSchema
  validateDatumTemplate(template)
  validateChildSchemas(template)
  return template
}
const validateDatumTemplate = (datumTemplate) => {
  const isValid = ajv.validate(datumSchema, datumTemplate)
  if (!isValid) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Datum failed validation: ${errors}`)
  }
}
const validateChildSchemas = (datum) => {
  // compilation will throw if schemas invalid
  try {
    ajv.compile(datum.schema)
    // TODO check that datum.uiSchema is formatted correctly
    if (!datum.network) {
      return
    }
    Object.values(datum.network).every((installer) => {
      if (installer.covenant === 'datum') {
        validateChildSchemas(installer.state)
      }
    })
  } catch (e) {
    const errors = ajv.errorsText(ajv.errors)
    throw new Error(`Child schemas failed validation: ${errors}`)
  }
}
const api = {
  set: { type: 'object', title: 'SET', description: '' },
  // subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  // unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
  // setDirectEdit: () => ({ type: 'SET_DIRECT' }), // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}
const name = 'datum'
export {
  name,
  api,
  reducer,
  convertToTemplate,
  validateDatumTemplate,
  validateFormData,
}
