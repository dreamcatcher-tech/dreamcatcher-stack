const definition = {
  id: 'interpreter.direct',
  initial: 'isReply',
  context: {
    // TODO populate with all modified context variables
  },
  strict: true,
  states: {
    isReply: {
      entry: 'assignDirectCovenantAction',
      always: [{ target: 'reply', cond: 'isReply' }, { target: 'request' }],
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
            {
              target: 'reject',
              cond: 'isReductionPending',
              actions: 'assignRejection', // TODO not sure this gets called in tests
            },
            { target: 'transmit' },
          ],
        },
        transmit: { entry: 'transmit', always: 'done' },
        reject: { entry: 'warnReplyRejection', always: 'done' }, // TODO hoist error to parent
        done: { type: 'final' },
      },
      onDone: 'done',
    },
    request: {
      initial: 'reduce',
      states: {
        reduce: {
          invoke: {
            src: 'reduceCovenant',
            onDone: { target: 'filterRePromise', actions: 'assignResolve' },
            onError: { target: 'reject', actions: 'assignRejection' },
          },
        },
        filterRePromise: {
          always: [
            {
              target: 'transmit',
              cond: 'isBufferedRequest',
              actions: 'filterRePromise',
            },
            { target: 'transmit' },
          ],
        },
        transmit: {
          entry: 'transmit',
          always: [
            { target: 'raisePending', cond: 'isReductionPending' },
            { target: 'respondLoopbackRequest' },
          ],
        },
        respondLoopbackRequest: {
          entry: 'mergeState',
          always: [
            { target: 'isBufferedRequest', cond: 'isAnvilNotLoopback' },
            { target: 'isBufferedRequest', cond: 'isLoopbackResponseDone' },
            { target: 'isBufferedRequest', actions: 'respondLoopbackRequest' },
          ],
        },
        raisePending: {
          entry: [
            'raisePending',
            'assignReplayIdentifiers',
            'promiseOriginRequest',
            'assignInitialPending',
          ],
          always: 'done',
        },
        reject: {
          entry: 'respondRejection',
          always: 'done',
        },
        isBufferedRequest: {
          always: [
            {
              target: 'done',
              cond: 'isBufferedRequest',
              actions: 'shiftBufferedRequest',
            },
            { target: 'done' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: 'done',
    },
    done: {
      data: (context) => context,
      type: 'final',
    },
  },
}

if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
