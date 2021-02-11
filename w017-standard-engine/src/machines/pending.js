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
