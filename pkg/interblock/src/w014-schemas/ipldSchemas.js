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
    Binary: {
      kind: 'link',
    },
    Address: {
      kind: 'link',
    },
    Request: {
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
          type: 'Binary',
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    ReplyTypes: {
      kind: 'enum',
      members: {
        REJECT: null,
        PROMISE: null,
        RESOLVE: null,
      },
      representation: {
        string: {
          REJECT: '@@REJECT',
          PROMISE: '@@PROMISE',
          RESOLVE: '@@RESOLVE',
        },
      },
    },
    Reply: {
      kind: 'struct',
      fields: {
        type: {
          type: 'ReplyTypes',
        },
        payload: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Any',
          },
        },
        binary: {
          type: 'Binary',
          optional: true,
        },
      },
      representation: {
        map: {},
      },
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
        nickname: {
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
      kind: 'struct',
      fields: {
        quorumThreshold: {
          type: 'Int',
        },
        validators: {
          type: {
            kind: 'list',
            valueType: {
              kind: 'link',
              expectedType: 'PublicKey',
            },
          },
        },
      },
      representation: {
        map: {},
      },
    },
    Signatures: {
      kind: 'list',
      valueType: 'String',
    },
    PromisedReply: {
      kind: 'struct',
      fields: {
        requestId: {
          type: 'Int',
        },
        reply: {
          type: {
            kind: 'link',
            expectedType: 'Reply',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    TxQueue: {
      kind: 'struct',
      fields: {
        requestsStart: {
          type: 'Int',
        },
        requests: {
          type: {
            kind: 'list',
            valueType: {
              kind: 'link',
              expectedType: 'Request',
            },
          },
        },
        repliesStart: {
          type: 'Int',
        },
        replies: {
          type: {
            kind: 'list',
            valueType: {
              kind: 'link',
              expectedType: 'Reply',
            },
          },
        },
        promisedIds: {
          type: {
            kind: 'list',
            valueType: 'Int',
          },
        },
        promisedReplies: {
          type: {
            kind: 'list',
            valueType: 'PromisedReply',
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
          type: 'Address',
        },
        precedent: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        system: {
          type: 'TxQueue',
        },
        covenant: {
          type: 'TxQueue',
        },
      },
      representation: {
        map: {},
      },
    },
    RxTracker: {
      kind: 'struct',
      fields: {
        requestsTip: {
          type: 'Int',
        },
        repliesTip: {
          type: 'Int',
        },
      },
      representation: {
        map: {},
      },
    },
    Channel: {
      kind: 'struct',
      fields: {
        tip: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        system: {
          type: 'RxTracker',
        },
        covenant: {
          type: 'RxTracker',
        },
        tx: {
          type: 'Tx',
        },
      },
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
        string: {
          PARENT: '..',
          LOOPBACK: '.',
          CHILD: './',
        },
      },
    },
    Alias: {
      kind: 'struct',
      fields: {
        systemRole: {
          type: 'SystemRoles',
        },
        channelId: {
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
        counter: {
          type: 'Int',
        },
        channels: {
          type: {
            kind: 'map',
            keyType: 'String',
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
      },
      representation: {
        map: {},
      },
    },
    PackageTypes: {
      kind: 'enum',
      members: {
        javascript: null,
        javascript_xstate: null,
        python: null,
        go: null,
        rust: null,
        haskell: null,
        c: null,
        cpp: null,
      },
      representation: {
        string: {},
      },
    },
    PackageState: {
      kind: 'struct',
      fields: {
        name: {
          type: 'String',
        },
        version: {
          type: 'String',
        },
        type: {
          type: 'PackageTypes',
        },
      },
      representation: {
        map: {},
      },
    },
    Covenant: {
      kind: 'struct',
      fields: {
        genesis: {
          type: 'Address',
        },
        pulse: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        info: {
          type: {
            kind: 'link',
            expectedType: 'PackageState',
          },
        },
        package: {
          type: 'Binary',
        },
      },
      representation: {
        map: {},
      },
    },
    Timestamp: {
      kind: 'struct',
      fields: {
        date: {
          type: 'String',
        },
      },
      representation: {
        map: {},
      },
    },
    ACL: {
      kind: 'struct',
      fields: {},
      representation: {
        map: {},
      },
    },
    State: {
      kind: 'map',
      keyType: 'String',
      valueType: 'Any',
    },
    Meta: {
      kind: 'struct',
      fields: {
        replies: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: {
              kind: 'map',
              keyType: 'String',
              valueType: 'Any',
            },
          },
        },
        deploy: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Any',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    RequestId: {
      kind: 'struct',
      fields: {
        channelId: {
          type: 'Int',
        },
        requestId: {
          type: 'Int',
        },
      },
      representation: {
        map: {},
      },
    },
    PendingRequest: {
      kind: 'struct',
      fields: {
        request: {
          type: {
            kind: 'link',
            expectedType: 'Request',
          },
        },
        to: {
          type: 'String',
        },
        id: {
          type: 'RequestId',
        },
      },
      representation: {
        map: {},
      },
    },
    Pending: {
      kind: 'struct',
      fields: {
        pendingRequest: {
          type: 'RequestId',
          optional: true,
        },
        requests: {
          type: {
            kind: 'list',
            valueType: 'PendingRequest',
          },
        },
        replies: {
          type: {
            kind: 'list',
            valueType: {
              kind: 'link',
              expectedType: 'Reply',
            },
          },
        },
      },
      representation: {
        map: {},
      },
    },
    SideEffectsConfig: {
      kind: 'struct',
      fields: {
        networkAccess: {
          type: {
            kind: 'list',
            valueType: 'String',
          },
        },
        asyncTimeoutMs: {
          type: 'Int',
        },
      },
      representation: {
        map: {},
      },
    },
    Interpulse: {
      kind: 'struct',
      fields: {
        version: {
          type: 'String',
        },
        package: {
          type: 'Binary',
        },
      },
      representation: {
        map: {},
      },
    },
    Entropy: {
      kind: 'struct',
      fields: {
        seed: {
          type: 'String',
        },
        count: {
          type: 'Int',
        },
      },
      representation: {
        map: {},
      },
    },
    Config: {
      kind: 'struct',
      fields: {
        isPierced: {
          type: 'Bool',
        },
        sideEffects: {
          type: 'SideEffectsConfig',
        },
        isPublicChannelOpen: {
          type: 'Bool',
        },
        acl: {
          type: {
            kind: 'link',
            expectedType: 'ACL',
          },
        },
        interpulse: {
          type: {
            kind: 'link',
            expectedType: 'Interpulse',
          },
        },
        entropy: {
          type: 'Entropy',
        },
        covenant: {
          type: {
            kind: 'link',
            expectedType: 'Covenant',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    Lineage: {
      kind: 'list',
      valueType: 'Link',
    },
    Turnovers: {
      kind: 'list',
      valueType: {
        kind: 'link',
        expectedType: 'Pulse',
      },
    },
    StateTreeNode: {
      kind: 'struct',
      fields: {
        state: {
          type: {
            kind: 'link',
            expectedType: 'State',
          },
        },
        binary: {
          type: {
            kind: 'link',
            expectedType: 'Binary',
          },
        },
        children: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: {
              kind: 'link',
              expectedType: 'StateTreeNode',
            },
          },
        },
      },
      representation: {
        map: {},
      },
    },
    PulseContents: {
      kind: 'struct',
      fields: {
        approot: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
        },
        validators: {
          type: {
            kind: 'link',
            expectedType: 'Validators',
          },
        },
        config: {
          type: {
            kind: 'link',
            expectedType: 'Config',
          },
        },
        binary: {
          type: 'Binary',
        },
        timestamp: {
          type: 'Timestamp',
        },
        network: {
          type: {
            kind: 'link',
            expectedType: 'Network',
          },
        },
        state: {
          type: {
            kind: 'link',
            expectedType: 'State',
          },
        },
        meta: {
          type: {
            kind: 'link',
            expectedType: 'Meta',
          },
        },
        pending: {
          type: {
            kind: 'link',
            expectedType: 'Pending',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    Provenance: {
      kind: 'struct',
      fields: {
        stateTree: {
          type: {
            kind: 'link',
            expectedType: 'StateTreeNode',
          },
        },
        lineageTree: {
          type: {
            kind: 'link',
            expectedType: 'Lineage',
          },
        },
        turnoversTree: {
          type: {
            kind: 'link',
            expectedType: 'Turnovers',
          },
        },
        genesis: {
          type: 'Address',
        },
        contents: {
          type: {
            kind: 'link',
            expectedType: 'PulseContents',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    Pulse: {
      kind: 'struct',
      fields: {
        provenance: {
          type: {
            kind: 'link',
            expectedType: 'Provenance',
          },
        },
        signatures: {
          type: 'Signatures',
        },
      },
      representation: {
        map: {},
      },
    },
  },
}
