import assert from 'assert-fast'
import * as datum from './datum'
import { interchain, useState } from '../../w002-api'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:apps:collection')

const { convertToTemplate, validateDatumTemplate, validateFormData } = datum

const add = async (payload, datumTemplate) => {
  assertFormData(payload)
  validateDatumTemplate(datumTemplate)
  validateFormData(payload, datumTemplate)
  const { formData } = payload
  const name = getChildName(datumTemplate, formData)
  const state = { datumTemplate: '..' }
  const covenant = 'datum'
  const installer = { state, covenant }
  if (datumTemplate.network) {
    installer.network = datumTemplate.network
  }
  const spawn = Request.createSpawn(name, installer)
  const result = await interchain(spawn)

  debug(`datum added`, result.alias)
  return result
}

// TODO allow collection to also store formData as tho it was a datum, without children spec
const reducer = async (request) => {
  const { type, payload } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')

  const [state, setState] = await useState()
  const { datumTemplate } = state

  switch (type) {
    case '@@INIT': {
      return
    }
    case 'ADD': {
      return await add(payload, datumTemplate)
    }
    case 'BATCH': {
      const { batch } = payload
      assert(Array.isArray(batch))

      const awaits = []
      for (const payload of batch) {
        const promise = add(payload, datumTemplate)
        awaits.push(promise)
      }
      for (const promise of awaits) {
        await promise
      }
      return state
    }
    case 'SET_TEMPLATE': {
      // TODO useState() should be able to set this remotely ?
      checkNoFormData(payload)
      const datumTemplate = convertToTemplate(payload)
      await setState({ ...state, datumTemplate })
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

const getChildName = (datumTemplate, formData) => {
  if (!datumTemplate.namePath || !datumTemplate.namePath.length) {
    debug(`getChildName is blank`)
    return
  }
  datumTemplate.namePath.forEach((name) => {
    formData = formData[name]
  })
  if (typeof formData === 'number') {
    formData = formData + ''
  }
  const prefix = datumTemplate.namePath.join('_')
  formData = prefix + '-' + formData
  assert.strictEqual(typeof formData, 'string')
  debug(`getChildName`, formData)
  return formData
}

const api = {
  add: {
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
  },
  batch: {
    type: 'object',
    title: 'BATCH',
    description: 'Add multiple elements to the collection as a batch',
    additionalProperties: false,
    required: ['batch'],
    properties: {
      batch: { type: 'array' },
    },
  },
  setTemplate: {
    type: 'object',
    title: 'SET_TEMPLATE',
    description: 'Change the template of the elements of this collection',
    additionalProperties: false,
    required: ['schema'],
    properties: {
      type: { type: 'string' },
      schema: { type: 'object' },
      network: { type: 'object' },
    },
  },
  search: {
    type: 'object',
    title: 'SEARCH',
    description: 'Search through this collection',
  },
}
const state = convertToTemplate({ type: 'COLLECTION', schema: {} })
export { reducer, api, state }
