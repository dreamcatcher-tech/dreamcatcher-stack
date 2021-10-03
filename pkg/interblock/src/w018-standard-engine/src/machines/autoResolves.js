const definition = {
  id: 'interpreter.autoResolves',
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
        { target: 'resolveExternalAction', cond: 'isNotPending' },
        { target: 'resolveExternalAction', cond: 'isStillPending' },
        { target: 'resolveExternalAction', cond: 'isOriginSettled' },
        { target: 'resolveExternalAction', actions: 'settleOrigin' },
      ],
    },
    resolveExternalAction: {
      always: [
        { target: 'done', cond: 'isExternalActionTypeReply' },
        { target: 'done', cond: 'isChannelRemoved' },
        { target: 'done', cond: 'isRequestRemoved' },
        { target: 'done', cond: 'isExternalRequestSettled' },
        { target: 'done', cond: 'isTxExternalActionPromise' },
        { target: 'done', cond: 'isExternalRequestBuffered' },
        { target: 'done', actions: 'resolveExternalAction' },
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
