/**
 * when we load the covenants, the models run thru and check the format of everything.
 * cannot use schema as functions do not translate into schema.
 * in dev mode, want to use functions as action creators - parse functions.
 * covenant exists in reified mode, and in inert / packaged mode
 * 
*** DOS: how to supply custom covenants and have them work in live editing ?
    [2021-06-25 Fri 11:27]
***** requirements
******* must work for single bare covenant, and complex ones with an installer
******* nested covenants need to be referred to by external chains
********* basePkg/nestedName
*********** we need to expand this out, and resolve ourselves
***** options
******* supply key "covenants" to export them ?
******* put in the installer, and strip out before publish
******* single default covenant is easy as can wrap
******* use nodejs exports to specify all covenants that you want loaded
******* children key to match datums, and to allow infinite nesting
********* allows compound covenants to be included as children of a higher compound app
******* require the installer to supply the covenants it refers to ?
***** reasoning
******* the covenant is both a single level, and nested container
***** model
******* spec the allowed covenant formats in a model, but require no standardization
******* could use model as means to generate the json object from reading a covenant
***** ? should there be different types of covenant for those that are nested, and those that are plain ?

 * 
 */
import assert from 'assert-fast'
import ParseFunction from 'parse-function'
const parseFunction = ParseFunction()

const covenantSchema = {
  type: 'object',
  description: `Valid formats for a Covenant, which may be nested.
    This object is used to publish and install with.`,
  required: ['covenantId', 'reducer'],
  additionalProperties: false,
  properties: {
    covenantId: { type: 'object' },
    reducer: {
      type: 'null',
      description: `Function to return next state.  Replaced by a throwing
        default if none supplied`,
      nullable: true,
    },
    actions: {
      type: 'null',
      description: `Object with keys as functions which
        create actions for this covenant to receive.  In dev mode, these are 
        kept as actions, but in prod, they are removed.`,
      nullable: true,
    },
    actionSchema: {
      type: 'object',
      description: `object with keys defining schema for actions.
        Used in auto generating forms and commandline args.`,
      additionalProperties: false,
      patternProperties: {
        '(.*?)': {
          type: 'object',
          definition: `Schema for an action`,
          required: ['type', 'payload'],
          properties: {
            type: { type: 'string' },
            payload: { type: 'object' },
          },
        },
      },
    },
    installer: {
      type: 'object',
      description: `Config file for creating multiple chains in a heirarchy,
        and connecting them together.`,
    },
    covenants: {
      type: 'object',
      description: `Covenants that were referenced in the installer.
        These may include nested covenants too.
        During packaging, the covenants are reified, then the json objects
        are created to represent them.
        During execution, the covenants are reified and looked up by path`,
      patternProperties: { '(.*?)': { $ref: '#' } },
    },
  },
}

const create = (raw) => {
  // creates a covenant using reasonable defaults if missing data
  // parse the installer and pull out all referenced covenants
  // find which are not system, and ensure they have been provided
}

/**
 * Each action creator should not attempt to do any processing of the inputs.
 * The inputs should directly translate to payload keys.
 * We cannot execute code when users are creating actions, so we need to
 * convert to a schema
 * @param {*} actions
 */
const guessActionSchema = (actions) => {
  const actionSchema = {}
  for (const name in actions) {
    const fn = actions[name]
    assert.strictEqual(typeof fn, 'function', `${name} is not a function`)
    const result = parseFunction.parse(fn)
  }
  const names = Object.keys(actions)
}

const isCovenant = (obj) => {
  // checks if a covenant is formatted correctly
}
