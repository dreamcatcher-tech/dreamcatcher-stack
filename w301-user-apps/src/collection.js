const assert = require('assert')
const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true, verbose: true })
const debug = require('debug')('interblock:apps:collection')
const { datum, validateDatumTemplate, validateFormData } = require('./datum')
const { interchain } = require('../../w002-api')
const {
  actions: { spawn },
} = require('../../w021-dmz-reducer')

const reducer = async (state, action) => {
  const { datumTemplate } = state
  let nextState = { ...state }
  const { type, payload } = action
  switch (type) {
    case 'ADD':
      // can only contain formData keys, or be testData
      _checkNoSchema(payload)
      _validate(payload, datumTemplate)

      let name = _getChildName(payload, datumTemplate)
      const { covenantId } = datum
      const spawnAction = spawn(name, { covenantId })
      if (name) {
        interchain(spawnAction)
      } else {
        const { alias } = await interchain(spawnAction)
        name = alias
      }
      const set = datum.actions.set()
      await interchain(set, name)

      break
    case 'SET_DATUM_TEMPLATE':
      _validateTemplate(payload)
      nextState.datumTemplate = payload
      break
    default:
      debug(action)
      throw new Error(`Unknown action type: ${action.type}`)
  }
  return nextState
}
const _validateTemplate = (datumTemplate) => {
  if (_isNoFormData(datumTemplate)) {
    throw new Error(`No formData allowed on datum template`)
  }
  if (!isValidDatum(datumTemplate)) {
    throw new Error(`Not a valid datum template`)
  }
}

const _isNoFormData = (datum) => {
  if (datum.formData) {
    return false
  }
  return Object.values(datum.children).every(_isNoFormData)
}

const _validate = (payload, datumTemplate) => {
  debug(`_checkSchema`)
}
const _getChildName = (payload, datumTemplate) => {
  if (!datumTemplate.namePath.length) {
    debug(`_getChildName is blank`)
    return
  }
  let obj = payload.formData
  datumTemplate.namePath.forEach((name) => {
    obj = obj[name]
  })
  assert.strictEqual(typeof obj, 'string')
  debug(`_getChildName`, obj)
  return obj
}

const actions = {
  add: (payload) => ({ type: 'ADD', payload }),
  setDatumTemplate: (schema, children) => ({
    type: 'SET_DATUM_TEMPLATE',
    payload: { schema, children },
  }),
  search: () => ({ type: 'SEARCH' }),
  lock: () => ({ type: 'LOCK' }), // block changes to the schema
  delete: () => ({ type: 'DELETE' }), // or can delete the child directly ?
}

const collection = { reducer, actions, covenantId: { name: 'collection' } }

module.exports = { collection }
