import assert from 'assert-fast'
import * as datum from './datum'
import { interchain, useState } from '../../w002-api'
import { Request } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interblock:apps:collection')

const { convertToTemplate, validateDatumTemplate, validateFormData } = datum

const addFn = async (payload, template) => {
  debug('add', payload)
  assertFormData(payload)
  validateDatumTemplate(template)
  const { formData } = payload
  const name = getChildName(template, formData)

  validateFormData(payload, template)
  const state = { schema: '..', formData }
  const covenant = 'datum'
  const installer = { state, covenant }
  if (template.network) {
    installer.network = template.network
  }
  const spawn = Request.createSpawn(name, installer)
  const result = await interchain(spawn)

  debug(`datum added`, result.alias)
  return result
}

// TODO allow collection to also store formData as tho it was a datum, without children spec
// TODO allow '.' to refer to a schema in the covenant installer state ?
const reducer = async (request) => {
  const { type, payload } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')

  switch (type) {
    case '@@INIT': {
      return
    }
    case 'ADD': {
      // TODO cause the child to fetch the template when it is spawned
      const [{ template }] = await useState()
      return await addFn(payload, template)
    }
    case 'BATCH': {
      const { batch } = payload
      assert(Array.isArray(batch))
      const [{ template }] = await useState()
      return await Promise.all(batch.map((payload) => addFn(payload, template)))
    }
    case 'SET_TEMPLATE': {
      // TODO useState() should be able to set this remotely ?
      checkNoFormData(payload)
      const template = convertToTemplate(payload)
      const [state, setState] = await useState()
      await setState({ ...state, template })
      return
    }
    default:
      debug(type)
      throw new Error(`Unknown action type: ${type}`)
  }
}
const assertFormData = (payload) => {
  const { formData, network, ...rest } = payload
  if (typeof formData === 'undefined') {
    throw new Error(`Must provide formData key`)
  }
  if (Object.keys(rest).length) {
    throw new Error(`Only allowed keys are formData and network`)
  }
  if (!network) {
    return
  }
  if (typeof network !== 'object') {
    throw new Error(`network must be object`)
  }
  const networkValues = Object.values(network)
  return networkValues.every((child) => assertFormData(child.state))
}
const checkNoFormData = (datum) => {
  if (datum.formData) {
    throw new Error(`No formData allowed on datum template`)
  }
  if (!datum.network) {
    return
  }
  const networkValues = Object.values(datum.network)
  return networkValues.every(checkNoFormData)
}

const getChildName = (template, formData) => {
  if (!template.namePath || !template.namePath.length) {
    debug(`getChildName is blank`)
    return
  }
  const { namePath } = template
  if (namePath) {
    formData = formData[namePath]
  }
  if (typeof formData === 'number') {
    formData = formData + ''
  }
  debug(`getChildName`, formData)
  return formData
}

const add = {
  type: 'object',
  title: 'ADD',
  description: 'Add an element to this collection',
  additionalProperties: false,
  required: ['formData'],
  properties: {
    formData: { type: 'object' },
    network: {
      type: 'object',
      description: 'Recursively defined children',
      // patternProperties: { '(.*?)': { $ref: '#' } },
    },
  },
}
const api = {
  add,
  batch: {
    type: 'object',
    title: 'BATCH',
    description: 'Add multiple elements to the collection as a batch',
    additionalProperties: false,
    required: ['batch'],
    properties: {
      batch: { type: 'array', items: add },
    },
  },
  // setTemplate: {
  //   type: 'object',
  //   title: 'SET_TEMPLATE',
  //   description: 'Change the template of the elements of this collection',
  //   additionalProperties: false,
  //   required: ['schema'],
  //   properties: {
  //     type: { type: 'string' },
  //     schema: { type: 'object' },
  //     network: { type: 'object' },
  //   },
  // },
}
const installer = { state: { type: 'COLLECTION', schema: {} } }
const name = 'collection'
export { reducer, api, installer, name }
