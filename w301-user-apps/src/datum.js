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

const initialState = {
  namePath: 'id', // array of keys, or single key
  formData: {},
  schema: {},
  uiSchema: {
    // how to display this datum
  },
  subscribers: [
    // list of paths that need to be notified when changes occur
    // error responses are ignored
  ],
  children: {
    child1: {
      namePath: 'id', // array of keys, or single key - optional
      formData: {},
      schema: {},
      children: {
        child2: {},
      },
      uiSchema: {
        // how to display this datum
      },
      subscribers: [
        // list of paths that need to be notified when changes occur
        // error responses are ignored
      ],
    },
  },
}
const stateKeys = [
  'namePath',
  'formData',
  'schema',
  'uiSchema',
  'subscribers',
  'children',
]
const reducer = async (state, action) => {
  // TODO run assertions on state shape
  const { type, payload } = action
  const { isTestData } = payload
  const nextState = {}
  switch (type) {
    case '@@INIT': {
      // if made from scratch, check state and make new children
      debug(`@@INIT`)
      break
    }
    case 'SET': {
      _checkProposedSchemas(payload)
      if (payload.children) {
        // TODO ensure even formData updates are atomic accross children
        // create any children we don't have yet with present state
        const { children } = await interchain(dmzReducer.actions.listChildren())
        for (const child in payload.children) {
          if (!children[child]) {
            // make a new dmz for it, with data preloaded
            debug(`creating new child: `, child)
            const setChild = actions.set({
              ...payload.children[child],
              isTestData,
            })
            const spawn = dmzReducer.actions.spawn(child)
            interchain(spawn)
            await interchain(setChild, child)
          }
        }

        // send down updates to all existing children
      }
      stateKeys.forEach((key) => {
        const value = payload[key] || state[key]
        if (value) {
          nextState[key] = value
        }
      })
      if (isTestData) {
        const hash = action.getHash()
        const seed = parseInt(Number('0x' + hash.substring(0, 14)))
        faker.seed(seed)
        let { formData } = payload
        formData = formData || nextState.formData || {}
        Object.keys(nextState.schema.properties).forEach((key) => {
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
        nextState.formData = formData
      }
      break
    }
    default:
      throw new Error(`Unknown action: ${type}`)
  }
  const { schema, formData } = nextState
  _validate(schema, formData)

  // create any children that were specified but uncreated yet

  return nextState
  // check schema and data match, throw if not
}
const _checkProposedSchemas = ({ schema, formData, children }) => {
  // check the provided data is legal for all children
}
const schemaMap = new WeakMap()
const _validate = (schema, instance) => {
  if (!schema) {
    throw new Error(`No schema supplied`)
  }
  let validator = schemaMap.get(schema)
  if (!validator) {
    try {
      validator = ajv.compile(schema)
      schemaMap.set(schema, validator)
    } catch (e) {
      const msg = `Compilation failed: ${schema && schema.title} ${e.message}`
      throw new Error(msg)
    }
  }
  const isValid = validator(instance)
  const errors = ajv.errorsText(validator.errors)
  if (!isValid) {
    throw new Error(`${schema.title} failed validation: ${errors}`)
  }
}

const actions = {
  // create is handled by init ?
  set: (rawPayload) => {
    const payload = { ...rawPayload }

    stateKeys.forEach((key) => {
      if (!payload[key]) {
        delete payload[key]
      }
    })
    return {
      type: 'SET',
      payload,
    }
  },
  subscribe: (...paths) => ({ type: 'SUBSCRIBE', payload: paths }),
  unsubscribe: (...paths) => ({ type: 'UN_SUBSCRIBE', payload: paths }),
}

const datumFactory = (schema, ui, isDirectEdit) => {
  // if isDirectEdit flag set, then can only be updated by the parent ? or fsm ?
}

const datum = { actions, reducer, covenantId: { name: 'datum' } }
module.exports = { datum }
