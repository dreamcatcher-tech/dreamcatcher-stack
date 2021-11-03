const definition = {
  id: 'interpreter.dmz',
  context: {
    // TODO populate with all modified context variables
  },
  strict: true,
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
        { target: 'done', cond: 'isReply' },
        { target: 'done', cond: 'isChannelUnavailable' },
        { target: 'respondLoopbackRequest' },
      ],
      // mergeSystemState is the only place address resolution can happen
      exit: 'resolveAccumulator',
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
