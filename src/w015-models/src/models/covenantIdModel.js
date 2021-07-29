import { standardize } from '../modelUtils'
import { integrityModel } from './integrityModel'

const covenantIdModel = standardize({
  schema: {
    title: 'CovenantId',
    description: `Covenants are how behaviour is introduced to the system.
A Covenant represents the loaded piece of language specific code.
A covenant is a binary package on disk, but in ram it is executable code.

In all languages, a reducer must be supplied.
This pure function takes a json state, and a json action, and returns a json state

Optionally, a list of async functions that are invoked by the side effect system 
may be supplied`,
    type: 'object',
    additionalProperties: false,
    required: ['name', 'version', 'integrity', 'language'],
    properties: {
      // TODO figure out if weakness introduced with malleable names
      name: { type: 'string' },
      version: {
        type: 'string',
      },
      integrity: integrityModel.schema,
      language: {
        enum: [
          'javascript',
          'javascript/xstate',
          'python',
          'go',
          'rust',
          'haskell',
          'c',
          'c++',
        ],
      },
    },
  },
  create(
    name = 'unity',
    version = '0.0.0',
    language = 'javascript',
    integrity = integrityModel.create()
  ) {
    if (!integrityModel.isModel(integrity)) {
      throw new Error(`Invalid integrity for name: ${name}`)
    }
    return covenantIdModel.clone({ name, version, integrity, language })
  },
  logicize(instance) {
    return {}
  },
})

export { covenantIdModel }
