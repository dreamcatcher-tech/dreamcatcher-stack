/**
 * Interpreter is responsible for:
 *  1. running the covenants
 *  2. managing their filesystem requests
 *  3. responding to requests
 *  4. marshalling all the DMZ interactions
 *
 * The context of the interpreter === Dmz
 * Interpreter has no side effects - it only modifies context.
 *
 */

const definition = {
  id: 'interpreter.direct',
  initial: 'isReply',
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
      initial: 'isUnbuffered',
      states: {
        isUnbuffered: {
          always: [
            { target: 'reduce', cond: 'isUnbuffered' },
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
            { target: 'respondRequest' },
          ],
        },
        respondRequest: {
          entry: 'mergeState',
          always: [
            { target: 'done', cond: 'isExternalAction' },
            { target: 'done', cond: 'isLoopbackResponseDone' },
            { target: 'done', actions: 'respondRequest' },
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
    done: { type: 'final' },
  },
}

if (typeof module === 'object') {
  module.exports = { definition }
} else {
  Machine(definition)
}
