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
        { target: 'reducePendingReply', cond: 'isReply' },
        { target: 'bufferRequest' },
      ],
    },
    bufferRequest: {
      entry: ['bufferRequest', 'promiseAnvil'],
      always: 'done',
    },
    reducePendingReply: {
      entry: ['accumulateReply', 'shiftCovenantAction'],
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
