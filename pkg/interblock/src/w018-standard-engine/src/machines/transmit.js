/**
 * Transmit supplies the ability to contact other instances
 * through the resource of network transmission.  The network handles external
 * addressing, so that virtual chain addresses can find physical
 * machine addresses.
 *
 * It manages handshaking, blacklisting, throttling, and will expand out to discovery
 * and DHT maintenance with other nodes.  Refetching missing interblocks is handled
 * here.
 *
 * What does transmit do?
 *    1. handshaking outbound
 *    1. send interblocks to pool internally
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
   *    targetted interblock from us,
   *      needing catchup
   *    targetted interblock for us,
   *      needing catchup
   *
   */
  id: 'transmit',
  initial: 'idle',
  context: {
    interblock: undefined,
    targetTxs: [],
  },
  strict: true,
  states: {
    idle: {
      on: {
        TRANSMIT_INTERBLOCK: {
          target: 'fetchTargetSockets',
          actions: 'assignInterblock',
        },
      },
    },
    done: {
      data: ({ targetTxs }) => targetTxs,
      type: 'final',
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
                    actions: 'extendSelfToGenesisAttempt',
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
                // TODO reuse genesis check for isPresent
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
      },
      onDone: 'done',
    },
  },
}
if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
