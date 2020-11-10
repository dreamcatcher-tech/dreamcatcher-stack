/**
 * Interpreter is responsible for:
 *  1. running the covenants
 *  2. managing their filesystem requests
 *  3. responding to requests
 *  4. marshalling all the DMZ interactions
 *
 * The context of the interpreter === Dmz
 * Interpreter has no side effects - it only modifies context.
 *
 */

const definition = {
  id: 'interpreter',
  initial: 'idle',
  context: {
    anvil: undefined,
    address: undefined,
    dmz: undefined,
    covenantAction: undefined,
    reduceRejection: undefined,
    reduceResolve: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        TICK: 'interpret',
      },
    },
    repeatSelf: {
      always: [
        { target: 'done', cond: 'isSelfExhausted' },
        { target: 'interpret', actions: 'loadSelfAnvil' },
      ],
    },
    interpret: {
      always: [
        { target: 'interpretSystem', cond: 'isSystem' },
        { target: 'interpretCovenant' },
      ],
    },
    interpretSystem: {
      initial: 'reduceSystem',
      states: {
        reduceSystem: {
          invoke: {
            src: 'reduceSystem',
            onDone: { target: 'merge', actions: 'assignResolve' },
            onError: { target: 'respondRejection', actions: 'assignRejection' },
          },
        },
        respondRejection: {
          // TODO what if a system reply rejects for some reason ? halt entire chain ?
          // for now, silently fail
          entry: 'respondRejection',
          always: 'done',
        },
        merge: {
          entry: ['transmitSystem', 'mergeSystemState'],
          always: [
            { target: 'done', cond: 'isChannelUnavailable' },
            { target: 'respondReply', cond: 'isReply' },
            { target: 'respondRequest' },
          ],
        },
        respondReply: {
          entry: 'respondReply',
          always: 'done',
        },
        respondRequest: {
          always: [
            { target: 'done', cond: 'isSystemResponseFromActions' },
            { target: 'done', actions: 'respondRequest' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: 'repeatSelf',
    },

    interpretCovenant: {
      initial: 'isPending',
      states: {
        isPending: {
          always: [
            { target: 'pending', cond: 'isPending' },
            { target: 'direct' },
          ],
        },
        pending: {
          initial: 'isReply',
          states: {
            isReply: {
              always: [
                { target: 'reducePendingReply', cond: 'isReply' },
                { target: 'done', actions: 'bufferRequest' },
              ],
            },
            reducePendingReply: {
              entry: ['accumulateReply', 'respondReply', 'shiftCovenantAction'],
              invoke: {
                src: 'reduceCovenant',
                onDone: {
                  target: 'transmit',
                  actions: 'assignResolve',
                },
                onError: {
                  target: 'rejectPending',
                  actions: 'assignRejection',
                },
              },
            },
            transmit: {
              entry: 'transmit', // TODO may accumulate tx too, to dedupe independently of changing channel structure
              always: [
                { target: 'done', cond: 'isReductionPending' },
                { target: 'resolvePending' },
              ],
            },
            rejectPending: {
              entry: ['rejectOriginRequest', 'settlePending'],
              always: 'done',
            },
            resolvePending: {
              entry: ['settlePending', 'mergeState'],
              always: [
                { target: 'done', cond: 'isResponseFromActions' },
                { target: 'done', actions: 'resolveOriginRequest' },
              ],
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        direct: {
          initial: 'isReply',
          states: {
            isReply: {
              entry: 'assignDirectCovenantAction',
              always: [
                { target: 'reply', cond: 'isReply' },
                { target: 'request' },
              ],
            },
            reply: {
              initial: 'reduce',
              states: {
                reduce: {
                  invoke: {
                    src: 'reduceCovenant',
                    onDone: { target: 'isPending', actions: 'assignResolve' },
                    onError: { target: 'reject', actions: 'assignRejection' },
                  },
                },
                isPending: {
                  always: [
                    { target: 'reject', cond: 'isReductionPending' },
                    { target: 'transmit' },
                  ],
                },
                transmit: { entry: 'transmit', type: 'final' },
                reject: { type: 'final' }, // TODO hoist error to parent
              },
              onDone: 'done',
            },
            request: {
              initial: 'reduce',
              states: {
                reduce: {
                  invoke: {
                    src: 'reduceCovenant',
                    onDone: { target: 'transmit', actions: 'assignResolve' },
                    onError: { target: 'reject', actions: 'assignRejection' },
                  },
                },
                transmit: {
                  entry: 'transmit',
                  always: [
                    { target: 'raisePending', cond: 'isReductionPending' },
                    { target: 'respond' },
                  ],
                },
                respond: {
                  entry: 'mergeState',
                  always: [
                    { target: 'isUnbuffered', cond: 'isResponseFromActions' },
                    { target: 'isUnbuffered', actions: 'respondRequest' },
                  ],
                },
                raisePending: {
                  entry: ['raisePending', 'promiseOriginRequest'],
                  always: 'isUnbuffered',
                },
                reject: {
                  entry: 'respondRejection',
                  always: 'isUnbuffered',
                },
                isUnbuffered: {
                  always: [
                    { target: 'done', cond: 'isUnbuffered' },
                    { target: 'done', actions: 'shiftBufferedRequests' },
                  ],
                },
                done: { type: 'final' },
              },
              onDone: 'done',
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        done: { type: 'final' },
      },
      onDone: 'repeatSelf',
    },
    done: {
      id: 'done',
      data: ({ dmz }) => dmz,
      type: 'final',
    },
  },
}
const dummyConfig = {
  actions: {},
  guards: { isSystem: () => false },
  services: {},
}
const machine = Machine(definition, dummyConfig)

if (typeof module === 'object') {
  module.exports = { definition, machine }
}
