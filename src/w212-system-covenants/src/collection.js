const assert = require('assert')
const debug = require('debug')('interblock:apps:collection')
const datum = require('./datum')
const {
  convertToTemplate,
  demuxFormData,
  validateDatumTemplate,
  muxTemplateWithFormData,
} = datum
const { interchain } = require('../../w002-api')
const {
  actions: { spawn },
} = require('../../w021-dmz-reducer')

// TODO allow collection to also store formData as tho it was a datum, without children spec
const reducer = async (state, action) => {
  const { type, payload } = action
  switch (type) {
    case '@@INIT': {
      debug('init')
      const template = state.datumTemplate || {}
      const datumTemplate = convertToTemplate(template)
      debug(`datumTemplate`, datumTemplate)
      return { ...state, datumTemplate }
    }
    case 'ADD': {
      // can only contain formData keys, or be testData
      const { datumTemplate } = state
      validateDatumTemplate(datumTemplate)
      // TODO make single method in datum to check incoming
      if (!payload.isTestData) {
        _checkOnlyFormData(payload)
      }
      const formData = demuxFormData(datumTemplate, action)
      let name = _getChildName(datumTemplate, formData)
      const { covenantId } = datum
      const spawnAction = spawn(name, { covenantId })
      if (name) {
        interchain(spawnAction)
      } else {
        const { alias } = await interchain(spawnAction)
        name = alias
      }
      const muxed = muxTemplateWithFormData(datumTemplate, formData)
      const set = datum.actions.set(muxed)
      debug(`datum set action`, set)
      // TODO set this in the state of the spawn, to reduce block count
      await interchain(set, name)
      return state
    }
    case 'SET_TEMPLATE': {
      _checkNoFormData(payload)
      const datumTemplate = convertToTemplate(payload)
      return { ...state, datumTemplate }
    }
    default:
      debug(action)
      throw new Error(`Unknown action type: ${action.type}`)
  }
}
const _checkOnlyFormData = (payload) => {
  const { formData, children, ...rest } = payload
  if (typeof formData === 'undefined') {
    throw new Error(`Must provide formData key`)
  }
  if (rest) {
    throw new Error(`Only allowed keys are formData and children`)
  }
  if (!children) {
    return
  }
  if (typeof children !== 'object') {
    throw new Error(`children must be object`)
  }
  const childValues = Object.values(children)
  return childValues.every(_checkOnlyFormData)
}
const _checkNoFormData = (datum) => {
  if (datum.formData) {
    throw new Error(`No formData allowed on datum template`)
  }
  if (!datum.children) {
    return
  }
  const childValues = Object.values(datum.children)
  return childValues.every(_checkNoFormData)
}

const _getChildName = (datumTemplate, payload) => {
  if (!datumTemplate.namePath.length) {
    debug(`_getChildName is blank`)
    return
  }
  let obj = payload.formData
  datumTemplate.namePath.forEach((name) => {
    obj = obj[name]
  })
  if (typeof obj === 'number') {
    obj = obj + ''
  }
  const prefix = datumTemplate.namePath.join('_')
  obj = prefix + '-' + obj
  assert.strictEqual(typeof obj, 'string')
  debug(`_getChildName`, obj)
  return obj
}

const actions = {
  add: (payload = {}) => ({ type: 'ADD', payload }),
  setDatumTemplate: (datumTemplate) => ({
    type: 'SET_TEMPLATE',
    payload: datumTemplate,
  }),
  search: () => ({ type: 'SEARCH' }),
  lock: () => ({ type: 'LOCK' }), // block changes to the schema
  delete: () => ({ type: 'DELETE' }), // or can delete the child directly ?
}

module.exports = { reducer, actions }