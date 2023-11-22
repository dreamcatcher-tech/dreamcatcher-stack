export default {
  types: {
    HashMapRoot: {
      struct: {
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
    },
    HashMapNode: {
      struct: {
        fields: {
          map: {
            type: 'Bytes',
          },
          data: {
            type: {
              list: {
                valueType: 'Element',
              },
            },
          },
        },
        representation: {
          tuple: {},
        },
      },
    },
    Element: {
      union: {
        members: [
          {
            link: {
              expectedType: 'HashMapNode',
            },
          },
          'Bucket',
        ],
        representation: {
          kinded: {
            link: {
              link: {
                expectedType: 'HashMapNode',
              },
            },
            list: 'Bucket',
          },
        },
      },
    },
    Bucket: {
      list: {
        valueType: 'BucketEntry',
      },
    },
    BucketEntry: {
      struct: {
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
    },
    Binary: {
      link: {},
    },
    Address: {
      link: {},
    },
    Request: {
      struct: {
        fields: {
          type: {
            type: 'String',
          },
          payload: {
            type: {
              map: {
                keyType: 'String',
                valueType: 'Any',
              },
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
    },
    ReplyTypes: {
      enum: {
        members: ['REJECT', 'PROMISE', 'RESOLVE'],
        representation: {
          string: {
            REJECT: '@@REJECT',
            PROMISE: '@@PROMISE',
            RESOLVE: '@@RESOLVE',
          },
        },
      },
    },
    Reply: {
      struct: {
        fields: {
          type: {
            type: 'ReplyTypes',
          },
          payload: {
            type: {
              map: {
                keyType: 'String',
                valueType: 'Any',
              },
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
    },
    PublicKeyTypes: {
      enum: {
        members: ['Ed25519', 'Secp256k1', 'RSA'],
        representation: {
          string: {},
        },
      },
    },
    PublicKey: {
      struct: {
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
    },
    Validators: {
      struct: {
        fields: {
          quorumThreshold: {
            type: 'Int',
          },
          publicKeys: {
            type: {
              list: {
                valueType: {
                  link: {
                    expectedType: 'PublicKey',
                  },
                },
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Signatures: {
      list: {
        valueType: 'String',
      },
    },
    Covenant: {
      string: {},
    },
    Timestamp: {
      struct: {
        fields: {
          isoDate: {
            type: 'String',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    ACL: {
      struct: {
        fields: {},
        representation: {
          map: {},
        },
      },
    },
    State: {
      map: {
        keyType: 'String',
        valueType: 'Any',
      },
    },
    GPT4: {
      struct: {
        fields: {
          system: {
            type: 'String',
          },
          topP: {
            type: 'Int',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Falcon40b: {
      struct: {
        fields: {},
        representation: {
          map: {},
        },
      },
    },
    Claude: {
      struct: {
        fields: {},
        representation: {
          map: {},
        },
      },
    },
    Llama: {
      struct: {
        fields: {},
        representation: {
          map: {},
        },
      },
    },
    AI: {
      union: {
        members: ['GPT4', 'Falcon40b', 'Claude', 'Llama'],
        representation: {
          envelope: {
            discriminantKey: 'name',
            contentKey: 'payload',
            discriminantTable: {
              GPT4: 'GPT4',
              Falcon40b: 'Falcon40b',
              Claude: 'Claude',
              Llama: 'Llama',
            },
          },
        },
      },
    },
    RequestId: {
      struct: {
        fields: {
          channelId: {
            type: 'Int',
          },
          stream: {
            type: 'String',
          },
          requestIndex: {
            type: 'Int',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    AsyncRequest: {
      struct: {
        fields: {
          request: {
            type: {
              link: {
                expectedType: 'Request',
              },
            },
          },
          to: {
            type: 'String',
          },
          requestId: {
            type: 'RequestId',
            optional: true,
          },
          settled: {
            type: {
              link: {
                expectedType: 'Reply',
              },
            },
            optional: true,
          },
        },
        representation: {
          map: {},
        },
      },
    },
    RxRequest: {
      struct: {
        fields: {
          request: {
            type: {
              link: {
                expectedType: 'Request',
              },
            },
          },
          requestId: {
            type: 'RequestId',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    AsyncTrail: {
      struct: {
        fields: {
          origin: {
            type: 'RxRequest',
          },
          settles: {
            type: {
              list: {
                valueType: 'AsyncRequest',
              },
            },
          },
          txs: {
            type: {
              list: {
                valueType: 'AsyncRequest',
              },
            },
          },
          reply: {
            type: {
              link: {
                expectedType: 'reply',
              },
            },
            optional: true,
          },
          openPaths: {
            type: {
              list: {
                valueType: 'RequestId',
              },
            },
            optional: true,
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Pending: {
      struct: {
        fields: {
          system: {
            type: {
              list: {
                valueType: {
                  link: {
                    expectedType: 'AsyncTrail',
                  },
                },
              },
            },
          },
          reducer: {
            type: {
              list: {
                valueType: {
                  link: {
                    expectedType: 'AsyncTrail',
                  },
                },
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    SideEffectsConfig: {
      struct: {
        fields: {
          networkAccess: {
            type: {
              list: {
                valueType: 'String',
              },
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
    },
    Entropy: {
      struct: {
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
    },
    Config: {
      struct: {
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
              link: {
                expectedType: 'ACL',
              },
            },
          },
          interpulse: {
            type: {
              link: {
                expectedType: 'Covenant',
              },
            },
          },
          entropy: {
            type: 'Entropy',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Dmz: {
      struct: {
        fields: {
          config: {
            type: {
              link: {
                expectedType: 'Config',
              },
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
              link: {
                expectedType: 'State',
              },
            },
          },
          embeddings: {
            type: {
              link: {
                expectedType: 'Embeddings',
              },
            },
          },
          pending: {
            type: {
              link: {
                expectedType: 'Pending',
              },
            },
            optional: true,
          },
          appRoot: {
            type: 'HistoricalPulseLink',
            optional: true,
          },
          binary: {
            type: 'Binary',
            optional: true,
          },
          covenant: {
            type: 'Covenant',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    PromisedReply: {
      struct: {
        fields: {
          requestIndex: {
            type: 'Int',
          },
          reply: {
            type: {
              link: {
                expectedType: 'Reply',
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    TxQueue: {
      struct: {
        fields: {
          requestsLength: {
            type: 'Int',
          },
          requests: {
            type: {
              list: {
                valueType: {
                  link: {
                    expectedType: 'Request',
                  },
                },
              },
            },
            optional: true,
          },
          repliesLength: {
            type: 'Int',
          },
          replies: {
            type: {
              list: {
                valueType: {
                  link: {
                    expectedType: 'Reply',
                  },
                },
              },
            },
            optional: true,
          },
          promisedRequestIds: {
            type: {
              list: {
                valueType: 'Int',
              },
            },
          },
          promisedReplies: {
            type: {
              list: {
                valueType: 'PromisedReply',
              },
            },
            optional: true,
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Tx: {
      struct: {
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
    },
    RxQueue: {
      copy: {
        fromType: 'TxQueue',
      },
    },
    Rx: {
      struct: {
        fields: {
          tip: {
            type: 'PulseLink',
            optional: true,
          },
          latest: {
            type: 'PulseLink',
            optional: true,
          },
          system: {
            type: 'RxQueue',
            optional: true,
          },
          reducer: {
            type: 'RxQueue',
            optional: true,
          },
          isSubscription: {
            type: 'Bool',
            optional: true,
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Channel: {
      struct: {
        fields: {
          channelId: {
            type: 'Int',
          },
          address: {
            type: 'Address',
          },
          tx: {
            type: {
              link: {
                expectedType: 'Tx',
              },
            },
          },
          rx: {
            type: 'Rx',
          },
          aliases: {
            type: {
              list: {
                valueType: 'String',
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Loopback: {
      copy: {
        fromType: 'Channel',
      },
    },
    Channels: {
      struct: {
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
              list: {
                valueType: 'Int',
              },
            },
          },
          txs: {
            type: {
              list: {
                valueType: 'Int',
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Network: {
      struct: {
        fields: {
          channels: {
            type: 'Channels',
          },
          children: {
            type: 'HashMapRoot',
            optional: true,
          },
          downlinks: {
            type: 'HashMapRoot',
          },
          uplinks: {
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
          piercings: {
            type: 'Rx',
            optional: true,
          },
        },
        representation: {
          map: {},
        },
      },
    },
    StateTreeNode: {
      struct: {
        fields: {
          state: {
            type: {
              link: {
                expectedType: 'State',
              },
            },
          },
          children: {
            type: 'HashMapRoot',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    BinaryTreeNode: {
      struct: {
        fields: {
          binary: {
            type: {
              link: {
                expectedType: 'Binary',
              },
            },
          },
          children: {
            type: 'HashMapRoot',
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Lineage: {
      list: {
        valueType: 'Link',
      },
    },
    Turnovers: {
      list: {
        valueType: 'HistoricalPulseLink',
      },
    },
    Provenance: {
      struct: {
        fields: {
          dmz: {
            type: {
              link: {
                expectedType: 'Dmz',
              },
            },
          },
          stateTree: {
            type: {
              link: {
                expectedType: 'StateTreeNode',
              },
            },
          },
          binaryTree: {
            type: {
              link: {
                expectedType: 'BinaryTreeNode',
              },
            },
          },
          lineageTree: {
            type: {
              link: {
                expectedType: 'Lineage',
              },
            },
          },
          validators: {
            type: {
              link: {
                expectedType: 'Validators',
              },
            },
          },
          turnovers: {
            type: {
              link: {
                expectedType: 'Turnovers',
              },
            },
          },
          address: {
            type: 'Address',
          },
          transmissions: {
            type: {
              map: {
                keyType: 'String',
                valueType: 'Tx',
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    Pulse: {
      struct: {
        fields: {
          provenance: {
            type: {
              link: {
                expectedType: 'Provenance',
              },
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
    PulseLink: {
      link: {},
    },
    HistoricalPulseLink: {
      copy: {
        fromType: 'PulseLink',
      },
    },
    InterProvenance: {
      struct: {
        fields: {
          validators: {
            type: {
              link: {
                expectedType: 'Validators',
              },
            },
            optional: true,
          },
          turnovers: {
            type: {
              link: {
                expectedType: 'Turnovers',
              },
            },
            optional: true,
          },
          address: {
            type: 'Address',
          },
          transmissions: {
            type: {
              map: {
                keyType: 'String',
                valueType: 'Tx',
              },
            },
          },
        },
        representation: {
          map: {},
        },
      },
    },
    InterPulse: {
      struct: {
        fields: {
          provenance: {
            type: {
              link: {
                expectedType: 'InterProvenance',
              },
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
  },
}
