const Ajv = require('ajv')
const ajv = new Ajv({ allErrors: true, verbose: true })
const debug = require('debug')('interblock:apps:collection')
const { datum } = require('./datum')
const { interchain } = require('../../w002-api')
const {
  actions: { spawn },
} = require('../../w021-dmz-reducer')

const initialState = {
  title: 'COLLECTION',
  type: {
    customer: {
      general: 'general',
      postal: 'address',
      service: 'address',
      services: 'services',
    },
  },
}

const reducer = async (state, action) => {
  let nextState = { ...state }
  const { type, payload } = action
  switch (type) {
    case 'ADD':
      // check the payload against the schema
      _checkSchema(payload, state.schema, state.children)
      const name = _getChildName(payload)
      const spawnAction = spawn(name, { covenantId: datum.covenantId })
      debug(spawnAction)
      interchain(spawnAction)
      const set = datum.actions.set()
      await interchain(set, name)
      // calculate the derived key
      // make a new child
      // dispatch payload
      // watch it unfurl its children

      break
    case 'SET_SCHEMA':
      nextState.schema = action.payload.schema
      nextState.children = action.payload.children
      break
    default:
      debug(action)
      throw new Error(`Unknown action type: ${action.type}`)
  }
  return nextState
}
const _checkSchema = (payload, schema, children) => {
  debug(`_checkSchema`)
}
const _getChildName = () => {
  debug(`_getChildName`)
}

const actions = {
  search: () => ({ type: 'SEARCH' }),
  add: (payload) => ({ type: 'ADD', payload }),
  setSchema: (schema, children) => ({
    type: 'SET_SCHEMA',
    payload: { schema, children },
  }),
  delete: () => ({ type: 'DELETE' }), // or can delete the child directly ?
}

const collectionFactory = (isExtensible) => {
  // isExtensible means collection cannot be extended with new members
}

const collection = { reducer, actions, covenantId: { name: 'collection' } }

module.exports = { collection }
