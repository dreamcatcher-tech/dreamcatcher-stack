/**
 * Transmit supplies the special ability to contact other instances
 * through the resource of transmission.  The network handles external
 * addressing, so that virtual chain addresses can find physical
 * machine addresses.
 *
 * It manages handshaking, blacklisting, throttling, and will expand out to discovery
 * and DHT maintenance with other nodes.  Refetching missing interblocks is handled
 * here.
 *
 * What does transmit do?
 *    1. handshaking outbound
 *    1. pool interblocks internally, and send catchups
 *    3. send interblocks externally, and send catchups, by looking up their socket info
 *    2. reject events because of blacklisted socket info or incorrect formats
 *    3. request retransmission of missing interblocks, while ignoring repeat requests
 *
 * Takes in a single interblock, which may be from internal producer, or external,
 * then returns an array of zero or more interblocks with socket info attached.
 */

const definition = {
  /**
   * dbCalls: socketInfo to address mapping
   *
   * Basically, make some io calls, and then send some stuff or pool it
   *    interblock -> interblocks + socketInfo
   * Incoming types are:
   *    light interblock from us
   *    targetted interblock from us,
   *      needing catchup
   *    targetted interblock for us,
   *      needing catchup
   *
   * if light interblock, lookup who to send to, which may include us, and send it
   * first check target
   *    look up address of target, which may be multiple, ior internal, then send
   *    check if catchups from source are needed
   *      if we are the source, send lineage, making sure we deduplicate
   * then treat as lineage, and see who needs it, except for target, then send
   */
  id: 'transmit',
  initial: 'idle',
  context: {
    interblock: undefined,
    listeningTxs: [],
    targetTxs: [],
    lineage: [],
    lineageTxs: [],
    transmissions: [],
  },
  strict: true,
  states: {
    idle: {
      on: {
        TRANSMIT_INTERBLOCK: {
          target: 'isLineageInterblock',
          actions: 'assignInterblock',
        },
      },
    },
    done: {
      entry: ['removeListeningTxs', 'mergeTransmissions'],
      data: ({ transmissions }) => transmissions,
      type: 'final',
    },
    isLineageInterblock: {
      always: [
        { target: 'fetchLineageSockets', cond: 'isLineageInterblock' },
        { target: 'fetchTargetSockets' },
      ],
    },
    fetchLineageSockets: {
      initial: 'fetchBlock',
      states: {
        fetchBlock: {
          invoke: {
            src: 'fetchBlock',
            onDone: [
              {
                target: 'fetchListeners',
                actions: 'assignBlock',
                cond: 'isBlockFetched',
              },
              { target: 'done' },
            ],
          },
        },
        done: { type: 'final' },
        fetchListeners: {
          type: 'parallel',
          states: {
            fetchRemoteListeners: {
              initial: 'promise',
              states: {
                promise: {
                  invoke: {
                    src: 'fetchRemoteListeners',
                    onDone: {
                      target: 'done',
                      actions: 'extendListeningTxs',
                    },
                  },
                },
                done: { type: 'final' },
              },
            },
            fetchSelfListener: {
              initial: 'promise',
              states: {
                promise: {
                  invoke: {
                    src: 'fetchSelfListener',
                    onDone: {
                      target: 'done',
                      actions: 'extendListeningTxs',
                    },
                  },
                },
                done: { type: 'final' },
              },
            },
          },
          onDone: 'done',
        },
      },
      onDone: 'done',
    },
    fetchTargetSockets: {
      type: 'parallel',
      states: {
        isGenesisAttempt: {
          initial: 'isGenesisAttempt',
          states: {
            isGenesisAttempt: {
              always: [
                {
                  target: 'isOriginPresent',
                  cond: 'isGenesisAttempt',
                },
                { target: 'done' },
              ],
            },
            isOriginPresent: {
              invoke: {
                src: 'isOriginPresent',
                onDone: [
                  {
                    target: 'done',
                    cond: 'isOriginPresent',
                    actions: 'extendGenesisAttempt',
                  },
                  { target: 'done' },
                ],
              },
            },
            done: { type: 'final' },
          },
        },
        fetchRemoteTargets: {
          // direct call for sockets
          initial: 'promise',
          states: {
            promise: {
              invoke: {
                src: 'fetchRemoteTargets',
                onDone: {
                  target: 'done',
                  actions: 'extendTargetTxs',
                },
              },
            },
            done: { type: 'final' },
          },
        },
        fetchSelfTarget: {
          // direct call for isPresent
          initial: 'promise',
          states: {
            promise: {
              invoke: {
                src: 'fetchSelfTarget',
                onDone: {
                  target: 'done',
                  actions: 'extendTargetTxs',
                },
              },
            },
            done: { type: 'final' },
          },
        },
        addLineage: {
          initial: 'isLineageRequired',
          states: {
            isLineageRequired: {
              always: [
                {
                  target: 'fetchLineageToGenesis',
                  cond: 'isInitiatingAction',
                },
                { target: 'done' },
              ],
            },
            fetchLineageToGenesis: {
              invoke: {
                src: 'fetchLineageToGenesis',
                onDone: {
                  target: 'done',
                  actions: 'assignLineage',
                },
              },
            },
            done: { type: 'final' },
          },
        },
      },
      onDone: { target: 'done', actions: 'extendLineageTxs' },
    },
  },
}
if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
