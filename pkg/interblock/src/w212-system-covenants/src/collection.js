import assert from 'assert-fast'
import * as datum from './datum'
import { interchain, useState } from '../../w002-api'
import { Request } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interblock:apps:collection')

const { validateDatumTemplate, validatePayload } = datum

const addFn = async (payload, template) => {
  debug('add', payload)
  validateDatumTemplate(template)
  const name = getChildName(template, payload)

  const state = payload
  const covenant = 'datum'
  const installer = { state, covenant }
  if (template.network) {
    installer.network = template.network
  }
  const spawn = Request.createSpawn(name, installer)
  const result = await interchain(spawn)

  debug(`datum added`, result.alias)
  return { path: result.alias }
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
    default:
      throw new Error(`Unknown action type: ${type}`)
  }
}
// TODO set up network to use the installer

const getChildName = (template, payload) => {
  if (!template.namePath || !template.namePath.length) {
    debug(`getChildName is blank`)
    return
  }
  const { namePath } = template
  if (namePath) {
    payload = payload[namePath]
  }
  if (typeof payload === 'number') {
    payload = payload + ''
  }
  debug(`getChildName`, payload)
  return payload
}

const add = {
  type: 'object',
  title: 'ADD',
  description: 'Add an element to this collection',
  // TODO make this auto generated
  // additionalProperties: false,
  required: [],
  properties: {},
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
}
const installer = { state: { type: 'COLLECTION', schema: {} } }
const name = 'collection'
export { reducer, api, installer, name }
