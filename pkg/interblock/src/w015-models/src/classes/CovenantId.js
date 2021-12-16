import { Integrity } from '.'
import { mixin } from '../MapFactory'
const schema = {
  title: 'CovenantId',
  //     description: `Covenants are how behaviour is introduced to the system.
  // A Covenant represents the loaded piece of language specific code.
  // A covenant is a binary package on disk, but in ram it is executable code.

  // In all languages, a reducer must be supplied.
  // This pure function takes a json state, and a json action, and returns a json state

  // Optionally, a list of async functions that are invoked by the side effect system
  // may be supplied`,
  type: 'object',
  additionalProperties: false,
  required: ['name', 'version', 'integrity', 'language'],
  properties: {
    // TODO figure out if weakness introduced with malleable names
    name: { type: 'string' },
    version: { type: 'string' },
    integrity: Integrity.schema,
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
}
export class CovenantId extends mixin(schema) {
  static create(
    name = 'unity',
    version = '0.0.0',
    language = 'javascript',
    integrity = Integrity.create()
  ) {
    if (!(integrity instanceof Integrity)) {
      throw new Error(`Invalid integrity for name: ${name}`)
    }
    return super.create({ name, version, integrity, language })
  }
}
