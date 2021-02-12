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
        done: { entry: 'respondReply', type: 'final' },
      },
      onDone: 'done',
    },
    request: {
      initial: 'isUnbufferedRequest',
      states: {
        isUnbufferedRequest: {
          always: [
            { target: 'reduce', cond: 'isUnbufferedRequest' },
            {
              target: 'reduce',
              actions: 'shiftBufferedRequest',
            },
          ],
        },
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
            { target: 'respondLoopbackRequest' },
          ],
        },
        respondLoopbackRequest: {
          entry: 'mergeState',
          always: [
            { target: 'done', cond: 'isLoopbackResponseDone' },
            { target: 'done', actions: 'respondLoopbackRequest' },
          ],
        },
        raisePending: {
          entry: [
            'raisePending',
            'promiseOriginRequest',
            'assignInitialPending',
          ],
          always: 'done',
        },
        reject: {
          entry: 'respondRejection',
          always: 'done',
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

if (typeof module === 'object') {
  module.exports = { definition }
} else {
  Machine(definition)
}
