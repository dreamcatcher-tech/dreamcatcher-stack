const definition = {
  id: 'interpreter.dmz',
  initial: 'reduceSystem',
  context: {
    // TODO populate with all modified context variables
  },
  strict: true,
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
