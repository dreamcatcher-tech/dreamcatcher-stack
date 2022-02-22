export const schemas = {
  types: {
    Any: {
      kind: 'union',
      representation: {
        kinded: {
          bool: 'Bool',
          int: 'Int',
          float: 'Float',
          string: 'String',
          bytes: 'Bytes',
          map: 'Map',
          list: 'List',
          link: 'Link',
        },
      },
    },
    ContinuationTypes: {
      kind: 'enum',
      members: { '@@REJECT': null, '@@PROMISE': null, '@@RESOLVE': null },
      representation: { string: {} },
    },
    Action: {
      // Messages for communicating with a reducer.
      // Actions are always delivered as part of a channel between chains.
      kind: 'struct',
      fields: {
        // The type of the action which is specified by the developer
        type: { type: 'String' },
        // Type dependent data being transmitted with the action
        payload: { type: 'map', keyType: 'String', valueType: 'Any' },
        binary: { type: 'Link', optional: true },
      },
      representation: { map: {} },
    },
    Continuation: {
      // make this copy the Action schema, but with an enum for the type ?
      // description: `Actions that implement the continuation system.`,
      kind: 'struct',
      fields: {
        type: 'ContinuationTypes',
        // description:
        //   'One of three types.  Synchronous replies are resolves or rejections too.',
        payload: { type: 'map', keyType: 'String', valueType: 'Any' },
        binary: { type: 'Link', optional: true },
      },
      representation: { map: {} },
    },
    Pulse: {
      kind: 'struct',
      fields: {},
      representation: { map: {} },
    },
    Provenance: {
      kind: 'struct',
      fields: {
        contents: { type: 'Link' },
        genesis: { type: { kind: 'link', expectedType: 'Block' } },
      },
      representation: { map: {} },
    },
    Signature: {
      kind: 'struct',
      fields: {
        signature: { type: 'String' },
      },
      representation: { map: {} },
    },
    Remote: {
      kind: 'struct',
      fields: {
        genesis: { type: 'Link' },
        replies: {
          // TODO can replies point to a specific block ?
          // TODO height be relative to this channel alone
          type: { kind: 'map', keyType: 'String', valueType: 'Continuation' },
        },
        requests: { type: { kind: 'list' }, valueType: 'Action' },
        precedent: { type: { kind: 'link', expectedType: 'Pulse' } },
      },
      representation: { map: {} },
    },
    // Channel: {},
  },
}
