const definition = {
  id: 'interpreter.pending',
  initial: 'isReply',
  context: {
    // TODO populate with all modified context variables
  },
  strict: true,
  states: {
    isReply: {
      always: [
        {
          target: 'isAwaiting',
          cond: 'isReply',
          actions: 'accumulateReply',
        },
        { target: 'bufferRequest' },
      ],
    },
    bufferRequest: {
      entry: ['bufferRequest', 'promiseAnvil'],
      always: 'done',
    },
    isAwaiting: {
      always: [
        { target: 'done', cond: 'isAwaiting' },
        { target: 'reducePendingReply' },
      ],
    },
    reducePendingReply: {
      entry: 'shiftCovenantAction',
      invoke: {
        src: 'reduceCovenant',
        onDone: {
          target: 'transmit',
          actions: 'assignPendingResolve',
        },
        onError: {
          target: 'rejectPending',
          actions: 'assignRejection',
        },
      },
    },
    transmit: {
      entry: 'transmit',
      always: [
        {
          target: 'done',
          cond: 'isReductionPending',
          actions: 'assignReplayIdentifiers',
        },
        { target: 'settlePending' },
      ],
    },
    rejectPending: {
      entry: ['rejectOriginRequest', 'settlePending'],
      always: 'done',
    },
    settlePending: {
      entry: ['settlePending', 'mergeState'],
      always: 'done',
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
