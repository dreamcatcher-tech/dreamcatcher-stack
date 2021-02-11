const definition = {
  id: 'interpreter.autoResolves',
  initial: 'isReply',
  context: {
    // TODO populate with all modified context variables
  },
  strict: true,

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
