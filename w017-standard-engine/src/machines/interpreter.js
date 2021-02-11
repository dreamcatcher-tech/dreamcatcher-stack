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
          invoke: {
            src: 'pending',
            onDone: { target: 'done', actions: 'assignDirectMachine' },
          },
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
      invoke: {
        src: 'autoResolves',
        onDone: { target: 'openPaths', actions: 'assignDirectMachine' },
      },
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
