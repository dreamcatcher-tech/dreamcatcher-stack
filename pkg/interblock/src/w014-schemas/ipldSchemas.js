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
    IndexedPromise: {
      kind: 'struct',
      fields: {
        index: {
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
    Mux: {
      kind: 'struct',
      fields: {
        requestsIndex: {
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
        repliesIndex: {
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
        },
        covenant: {
          type: 'Mux',
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
    IO: {
      kind: 'struct',
      fields: {},
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
    Covenant: {
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
        systemPackage: {
          type: 'String',
          optional: true,
        },
        package: {
          type: 'Link',
          optional: true,
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
        epochMs: {
          type: 'Int',
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
        covenant: {
          type: {
            kind: 'link',
            expectedType: 'Covenant',
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
        lineage: {
          type: {
            kind: 'link',
            expectedType: 'Lineage',
          },
        },
        turnovers: {
          type: 'Turnovers',
        },
        genesis: {
          type: {
            kind: 'link',
            expectedType: 'Pulse',
          },
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
