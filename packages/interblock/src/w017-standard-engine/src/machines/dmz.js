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
        { target: 'respondLoopbackRequest' },
      ],
    },
    respondReply: {
      entry: 'respondReply',
      always: 'done',
    },
    respondLoopbackRequest: {
      always: [
        { target: 'done', cond: 'isAnvilNotLoopback' },
        { target: 'done', cond: 'isLoopbackResponseDone' },
        { target: 'done', actions: 'respondLoopbackRequest' },
      ],
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
