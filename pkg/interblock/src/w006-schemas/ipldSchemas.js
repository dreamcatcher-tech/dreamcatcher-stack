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
        precedent: {
          type: 'PulseLink',
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
    RxRemaining: {
      kind: 'struct',
      fields: {
        requestsRemaining: {
          type: 'Int',
        },
        repliesRemaining: {
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
          type: 'PulseLink',
          optional: true,
        },
        system: {
          type: 'RxRemaining',
          optional: true,
        },
        reducer: {
          type: 'RxRemaining',
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
        address: {
          type: 'Address',
        },
        tx: {
          type: {
            kind: 'link',
            expectedType: 'Tx',
          },
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
    Channels: {
      kind: 'struct',
      fields: {
        counter: {
          type: 'Int',
        },
        list: {
          type: 'HashMapRoot',
        },
        addresses: {
          type: 'HashMapRoot',
        },
        rxs: {
          type: {
            kind: 'list',
            valueType: 'Int',
          },
          optional: true,
        },
        txs: {
          type: {
            kind: 'list',
            valueType: 'Int',
          },
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    Network: {
      kind: 'struct',
      fields: {
        parent: {
          type: 'Channel',
          optional: true,
        },
        loopback: {
          type: 'Channel',
          optional: true,
        },
        io: {
          type: 'Channel',
          optional: true,
        },
        channels: {
          type: 'Channels',
          optional: true,
        },
        children: {
          type: 'HashMapRoot',
          optional: true,
        },
        uplinks: {
          type: 'HashMapRoot',
          optional: true,
        },
        downlinks: {
          type: 'HashMapRoot',
          optional: true,
        },
        symlinks: {
          type: 'HashMapRoot',
          optional: true,
        },
        hardlinks: {
          type: 'HashMapRoot',
          optional: true,
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
        address: {
          type: 'Address',
        },
        pulse: {
          type: 'PulseLink',
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
          optional: true,
        },
      },
      representation: {
        map: {},
      },
    },
    Pending: {
      kind: 'struct',
      fields: {
        rxPendingRequest: {
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
      valueType: 'PulseLink',
    },
    Provenance: {
      kind: 'struct',
      fields: {
        dmz: {
          type: {
            kind: 'link',
            expectedType: 'Dmz',
          },
        },
        states: {
          type: {
            kind: 'link',
            expectedType: 'StateTreeNode',
          },
        },
        lineages: {
          type: {
            kind: 'link',
            expectedType: 'Lineage',
          },
        },
        validators: {
          type: {
            kind: 'link',
            expectedType: 'Validators',
          },
        },
        turnovers: {
          type: {
            kind: 'link',
            expectedType: 'Turnovers',
          },
        },
        address: {
          type: 'Address',
        },
        transmissions: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Tx',
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
    PulseLink: {
      kind: 'link',
    },
    InterProvenance: {
      kind: 'struct',
      fields: {
        validators: {
          type: {
            kind: 'link',
            expectedType: 'Validators',
          },
          optional: true,
        },
        turnovers: {
          type: {
            kind: 'link',
            expectedType: 'Turnovers',
          },
          optional: true,
        },
        address: {
          type: 'Address',
        },
        transmissions: {
          type: {
            kind: 'map',
            keyType: 'String',
            valueType: 'Tx',
          },
        },
      },
      representation: {
        map: {},
      },
    },
    InterPulse: {
      kind: 'struct',
      fields: {
        provenance: {
          type: {
            kind: 'link',
            expectedType: 'InterProvenance',
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
