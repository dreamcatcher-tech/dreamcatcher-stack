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
    ContinuationTypes: {
      kind: 'enum',
      members: { '@@REJECT': null, '@@PROMISE': null, '@@RESOLVE': null },
      representation: { string: {} },
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
        genesis: { type: { kind: 'link', expectedType: 'Pulse' } },
      },
      representation: { map: {} },
    },
    // Address: {
    //   // special object that wraps a link, just like RawBinary wraps a Block
    //   // without it, information attempts to be implied by what a link is
    // },
    PublicKey: {
      kind: 'struct',
      fields: {
        key: 'String', // supposed to be an IPFS PeerID
        algorithm: 'String',
      },
      representation: { map: {} },
    },
    Validators: {
      kind: 'map',
      keyType: 'String',
      valueType: { kind: 'link', expectedType: 'PublicKey' },
    },
    Signature: {
      kind: 'struct',
      fields: {
        signature: { type: 'String' },
      },
      representation: { map: {} },
    },
    // Tx: {
    //   kind: 'struct',
    //   fields: {
    //     genesis: { type: 'Link' },
    //     requests: { type: { kind: 'list', valueType: 'Action' } },
    //     replies: {
    //       // TODO can replies point to a specific block ?
    //       // TODO height be relative to this channel alone
    //       type: { kind: 'map', keyType: 'String', valueType: 'Continuation' },
    //     },
    //     promises: { type: { kind: 'list', valueType: 'Continuation' } },
    //     precedent: { type: { kind: 'link', expectedType: 'Pulse' } },
    //   },
    //   representation: { map: {} },
    // },
    SystemRoles: {
      kind: 'enum',
      members: {
        '..': null,
        '.': null,
        './': null,
        UP_LINK: null,
        DOWN_LINK: null,
        PIERCE: null,
      },
      representation: { string: {} },
    },
    // Channel: {
    //   kind: 'struct',
    //   fields: {
    //     tx: { type: { kind: 'Tx' } },
    //     systemRole: 'SystemRoles',
    //     tip: {
    //       // matches up with precedent on the other side
    //       type: { kind: 'Link', expectedType: 'Pulse' },
    //     },
    //   },
    //   representation: { map: {} },
    // },
  },
}

/**
const RemoteChannelExample = {
  precedent: CIDPrecedent,
  requests: [action1, action2, action3],
  replies: [
    { CID0: [null, null, lateReply] },
    { CID1: [reply1, reply2, null, reply4] },
    { CID2: [reply1, reply2, reply3] },
  ],
  promises: [{ CID0: [3, 5, 6, 9] }, { CID1: [2] }],
  genesis: CIDGenesis,
}
*/
