export const schemas = {
  types: {
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
    Block: {
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
  },
}
