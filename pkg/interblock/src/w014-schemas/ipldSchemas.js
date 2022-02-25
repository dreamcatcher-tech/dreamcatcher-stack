export default {
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
      kind: 'struct',
      fields: {
        type: {
          type: 'String',
        },
        payload: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Any',
          },
        },
        binary: {
          type: 'Link',
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    ContinuationTypes: {
      kind: 'enum',
      members: {
        REJECT: null,
        PROMISE: null,
        RESOLVE: null,
      },
      representation: {
        string: {},
      },
    },
    Continuation: {
      kind: 'struct',
      fields: {
        type: {
          type: 'ContinuationTypes',
        },
        payload: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Any',
          },
        },
        binary: {
          type: 'Link',
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    Pulse: {
      kind: 'struct',
      fields: {
        genesis: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        lineage: {
          type: 'Link',
        },
        turnovers: {
          type: 'Link',
        },
      },
      representation: {
        map: {},
      },
    },
    Provenance: {
      kind: 'struct',
      fields: {
        contents: {
          type: 'Link',
        },
        signatures: {
          type: 'Signatures',
        },
      },
      representation: {
        map: {},
      },
    },
    Address: {
      kind: 'link',
    },
    PublicKeyTypes: {
      kind: 'enum',
      members: {
        Ed25519: null,
        Secp256k1: null,
        RSA: null,
      },
      representation: {
        string: {},
      },
    },
    PublicKey: {
      kind: 'struct',
      fields: {
        key: {
          type: 'String',
        },
        name: {
          type: 'String',
        },
        algorithm: {
          type: 'PublicKeyTypes',
        },
      },
      representation: {
        map: {},
      },
    },
    Validators: {
      kind: 'list',
      valueType: 'PublicKey',
    },
    Signatures: {
      kind: 'list',
      valueType: 'String',
    },
    IndexedPromise: {
      kind: 'struct',
      fields: {
        index: {
          type: 'Int',
        },
        reply: {
          type: 'Continuation',
        },
      },
      representation: {
        map: {},
      },
    },
    Mux: {
      kind: 'struct',
      fields: {
        requestsIndex: {
          type: 'Int',
        },
        requests: {
          type: {
            kind: 'list',
            valueType: 'Action',
          },
        },
        repliesIndex: {
          type: 'Int',
        },
        replies: {
          type: {
            kind: 'list',
            valueType: 'Continuation',
          },
        },
        promisesIndex: {
          type: {
            kind: 'list',
            valueType: 'Int',
          },
        },
        promises: {
          type: {
            kind: 'list',
            valueType: 'IndexedPromise',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    Tx: {
      kind: 'struct',
      fields: {
        genesis: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        precedent: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        system: {
          type: 'Mux',
          optional: true,
        },
        covenant: {
          type: 'Mux',
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    Channel: {
      kind: 'struct',
      fields: {
        tx: {
          type: 'Tx',
        },
        systemRole: {
          type: 'SystemRoles',
        },
        tip: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        system: {
          type: 'Mux',
        },
        covenant: {
          type: 'Mux',
        },
      },
      representation: {
        map: {},
      },
    },
    Txs: {
      kind: 'struct',
      fields: {},
      representation: {
        map: {},
      },
    },
    SystemRoles: {
      kind: 'enum',
      members: {
        PARENT: null,
        LOOPBACK: null,
        CHILD: null,
        UP_LINK: null,
        DOWN_LINK: null,
        PIERCE: null,
      },
      representation: {
        string: {},
      },
    },
    Alias: {
      kind: 'struct',
      fields: {
        systemRole: {
          type: 'SystemRoles',
        },
        channelIndex: {
          type: 'Int',
        },
      },
      representation: {
        map: {},
      },
    },
    Network: {
      kind: 'struct',
      fields: {
        channels: {
          type: {
            kind: 'list',
            valueType: 'Channel',
          },
        },
        aliases: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Alias',
          },
        },
        txs: {
          type: 'Txs',
        },
        unresolved: {
          type: {
            kind: 'list',
            valueType: 'Int',
          },
        },
      },
      representation: {
        map: {},
      },
    },
  },
}
