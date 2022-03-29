export default {
  types: {
    HashMapRoot: {
      kind: 'struct',
      fields: {
        hashAlg: {
          type: 'Int',
        },
        bucketSize: {
          type: 'Int',
        },
        hamt: {
          type: 'HashMapNode',
        },
      },
      representation: {
        map: {},
      },
    },
    HashMapNode: {
      kind: 'struct',
      fields: {
        map: {
          type: 'Bytes',
        },
        data: {
          type: {
            kind: 'list',
            valueType: 'Element',
          },
        },
      },
      representation: {
        tuple: {},
      },
    },
    Element: {
      kind: 'union',
      representation: {
        kinded: {
          link: {
            kind: 'link',
            expectedType: 'HashMapNode',
          },
          list: 'Bucket',
        },
      },
    },
    Bucket: {
      kind: 'list',
      valueType: 'BucketEntry',
    },
    BucketEntry: {
      kind: 'struct',
      fields: {
        key: {
          type: 'Bytes',
        },
        value: {
          type: 'Any',
        },
      },
      representation: {
        tuple: {},
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
        name: {
          type: 'String',
        },
        key: {
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
        publicKeys: {
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
          optional: true,
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
          optional: true,
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
          optional: true,
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
          optional: true,
        },
        system: {
          type: 'TxQueue',
        },
        reducer: {
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
    Rx: {
      kind: 'struct',
      fields: {
        tip: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
          optional: true,
        },
        system: {
          type: 'RxTracker',
          optional: true,
        },
        reducer: {
          type: 'RxTracker',
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
        rx: {
          type: 'Rx',
        },
        aliases: {
          type: {
            kind: 'list',
            valueType: 'String',
          },
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
          type: 'HashMapRoot',
        },
        aliases: {
          type: 'HashMapRoot',
        },
        loopback: {
          type: 'Channel',
        },
        parent: {
          type: 'Channel',
        },
        rxs: {
          type: 'HashMapRoot',
        },
        txs: {
          type: {
            kind: 'list',
            valueType: {
              kind: 'link',
              expectedType: 'Tx',
            },
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
        isoDate: {
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
            expectedType: 'Covenant',
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
    Dmz: {
      kind: 'struct',
      fields: {
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
        timestamp: {
          type: 'Timestamp',
        },
        network: {
          type: 'Network',
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
          optional: true,
        },
        approot: {
          type: 'PulseLink',
          optional: true,
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
          type: 'Dmz',
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
    PulseLink: {
      kind: 'link',
    },
  },
}
