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
    isolatedTick: undefined, // function provided as initial context
    externalAction: undefined,
    anvil: undefined,
    address: undefined, // TODO why is this needed ?
    dmz: undefined,
    initialPending: undefined, // used to determine if lowered during execution, and if loopback requests came from buffer
    covenantAction: undefined,
    reduceRejection: undefined,
    reduceResolve: undefined,
    isExternalPromise: undefined,
    isOriginPromise: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        TICK: {
          target: 'interpret',
          actions: ['assignExternalAction', 'assignDmz', 'assignAnvil'],
        },
      },
    },
    loopback: {
      always: [
        { target: 'autoResolves', cond: 'isSelfExhausted' },
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
          entry: 'respondRejection',
          always: 'done',
        },
        merge: {
          entry: ['mergeSystemState', 'transmit'],
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
            { target: 'done', cond: 'isExternalAction' },
            { target: 'done', cond: 'isLoopbackResponseDone' },
            { target: 'done', actions: 'respondRequest' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: 'loopback',
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
                { target: 'bufferRequest' },
              ],
            },
            bufferRequest: {
              entry: 'bufferRequest',
              always: [
                { target: 'done', cond: 'isAnvilPromised' },
                { target: 'done', actions: 'promiseAnvil' },
              ],
            },
            reducePendingReply: {
              entry: ['accumulateReply', 'shiftCovenantAction'],
              invoke: {
                src: 'reduceCovenant',
                onDone: {
                  target: 'deduplicatePendingReplyTx',
                  actions: 'assignResolve',
                },
                onError: {
                  target: 'rejectPending',
                  actions: 'assignRejection',
                },
              },
              exit: 'respondReply',
            },
            deduplicatePendingReplyTx: {
              entry: 'deduplicatePendingReplyTx',
              always: 'transmit',
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
              always: 'done',
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        direct: {
          invoke: {
            src: 'direct',
            onDone: { target: 'done', actions: 'assignDirectMachine' },
          },
        },
        done: { type: 'final' },
      },
      onDone: 'loopback',
    },
    autoResolves: {
      // loopback auto responses are handled at the time,
      // but external and origin are handled after exhaustion
      // defer auto resolve of external action until final step
      // defer auto resolve of origin promise until final step
      // discern when external action is promised from actions
      // discern when origin action is promised from actions

      // if no reply at all, default resolve.
      // if it is a reply, we know it was processed earlier, as replies are processed immediately
      // if rejection or resolve there already, do nothing
      // if promise is there, do nothing if transmit also sent a promise
      // if transmit did not send the promise, this must be buffered, so resolve it

      initial: 'settleOrigin',
      states: {
        settleOrigin: {
          // if we went from pending to settled, then origin must be resolved
          // transmit needs to also track if origin was promised to...
          always: [
            { target: 'settleExternalAction', cond: 'isOriginSettled' },
            { target: 'settleExternalAction', cond: 'isPendingUnlowered' },
            // TODO remove isTxOriginPromise as shiftBuffer removes this
            { target: 'settleExternalAction', cond: 'isTxOriginPromise' },
            {
              target: 'settleExternalAction',
              actions: 'settleOrigin',
            },
          ],
        },
        settleExternalAction: {
          always: [
            { target: 'done', cond: 'isExternalActionReply' },
            { target: 'done', cond: 'isExternalActionAbsent' },
            { target: 'done', cond: 'isExternalActionSettled' },
            { target: 'done', cond: 'isTxExternalActionPromise' },
            { target: 'done', cond: 'isExternalActionBuffered' },
            { target: 'done', actions: 'settleExternalAction' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: 'openPaths',
    },
    openPaths: {
      entry: [
        'openPaths',
        'invalidateLocalPaths',
        'removeEmptyInvalidChannels',
      ],
      always: 'done',
    },
    done: {
      entry: 'assertLoopbackEmpty',
      data: ({ dmz }) => dmz,
      type: 'final',
    },
  },
}

if (typeof module === 'object') {
  module.exports = { definition }
} else {
  Machine(definition)
}
