const reducer = (request) => {
  if (request.type !== '@@INIT') {
    throw new Error(`Covenant was sent request: ${request.type}`)
  }
}
/**
 * PROBLEMS
 * 1. Merging options - if higher up specifies options, should they be merged
 *    with the developer supplied options ?  Should the developer decide this
 *    inside the reducer ?
 * 2. Specifying null - what if we want no options passed to this covenant ?
 * 3. Rejection of options - the covenant author should be able to refuse
 *    some options
 *
 * Nested covenants:
 * There are two types of tree:
 * 1. The chain tree
 * 2. The covenant tree
 *
 * In the covenant tree, all pathing is relative to the actual filesystem
 * if posix pathing is used, or relative to the root covenant that defined
 * the current covenant if schemaRef pathing is used.
 */
const covenantSchema = {
  // TODO define this schema
  type: 'object',
  description: `Valid formats for a Covenant, which may be nested.`,
  required: ['reducer'],
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    reducer: {
      type: 'null',
      description: `Function to respond to requests and interact with the system.  Code is held in the binary of this chain.`,
      nullable: true,
    },
    api: {
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
      description: `Spawn options for making the initial chain.  These
      are directly translated into the dmz of the child, except for the 
      "network" key which is used to deploy children using the config
      specified at each key`,
      properties: {
        config: { type: 'object', description: 'config for the chain' },
        state: { type: 'object', description: 'initial state of the chain' },
        network: {
          type: 'object',
          description: 'children to be deployed',
          patternProperties: { '(.*?)': { $ref: '#/installer' } },
        },
      },
    },
    covenants: {
      type: 'object',
      description: `Covenants to be deployed with this covenant
      Referenced by [thisCovenantName]/[nestedCovenantName]
      Unpacked by the overloader so lookup can occur.
      These covenants can contain further nested covenants within them.
      Upon publish, these might be individually published as children.`,
      patternProperties: {
        '(.*?)': { $ref: '#' },
      },
    },
  },
}
const name = 'covenant'
export { name, reducer }
