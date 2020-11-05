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
  id: 'interpreter',
  initial: 'idle',
  context: {
    anvil: undefined,
    address: undefined,
    dmz: undefined,
    covenantAction: undefined,
    reduceRejection: undefined,
    reduceResolve: undefined,
    originalLoopback: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        TICK: 'reduce',
      },
    },
    done: {
      id: 'done',
      data: ({ dmz }) => dmz,
      type: 'final',
    },
    reduce: {
      initial: 'isSystem',
      states: {
        isSystem: {
          always: [
            { target: 'reduceSystem', cond: 'isSystem' },
            { target: 'isSettled' },
          ],
        },
        reduceSystem: {
          invoke: {
            src: 'reduceSystem',
            onDone: { target: 'done', actions: 'assignResolve' },
            onError: 'error',
          },
        },
        isSettled: {
          always: [
            {
              target: 'reduceCovenant',
              cond: 'isSettled',
              actions: 'assignCovenantAction',
            },
            { target: 'done', cond: 'isRequest', actions: 'bufferRequest' },
            {
              target: 'reduceCovenant',
              actions: ['accumulate', 'shiftCovenantAction'],
            },
          ],
        },
        reduceCovenant: {
          invoke: {
            // TODO test the actions are allowed actions using the ACL
            src: 'reduceCovenant',
            onDone: { target: 'done', actions: 'assignResolve' },
            onError: 'error',
          },
        },
        error: {
          type: 'final',
          entry: 'assignRejection',
        },
        done: {
          type: 'final',
        },
      },
      onDone: { target: 'merge' },
    },
    merge: {
      initial: 'isRejection',
      states: {
        isRejection: {
          entry: 'assignOriginalLoopback',
          always: [
            { target: 'done', cond: 'isRejection' },
            { target: 'done', actions: 'mergeSystem', cond: 'isSystem' },
            { target: 'mergeCovenant' },
          ],
        },
        // TODO check tx actions are correct against ACL, else throw
        mergeCovenant: {
          // transmit all the requests and replies
          //    deduplicate in case have run before
          // if pending has toggled on:
          //    set the anvil as the origin action in dmz.pending
          //    promise to the origin action
          // if still pending from previous:
          //    deduplicate all tx as might have run before ?
          // if pending lowered
          //    update state
          //    update pending & clear replies buffer
          //    resolve the origin action
          entry: 'transmit',
          always: [
            {
              target: 'done',
              cond: 'isPendingRaised',
              actions: ['raisePending'],
            },
            {
              target: 'done',
              cond: 'isPendingLowered',
              actions: ['resolveOriginPromise', 'lowerPending', 'updateState'],
            },
            { target: 'done' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: 'respond',
    },
    respond: {
      initial: 'isReply',
      states: {
        isReply: {
          always: [
            { target: 'done', cond: 'isChannelUnavailable' },
            { target: 'done', cond: 'isReply', actions: 'respondReply' },
            {
              target: 'done',
              cond: 'isRejection',
              actions: 'respondRejection',
            },
            { target: 'respondRequest' },
          ],
        },
        respondRequest: {
          always: [
            // if we buffered the request, respond with a promise
            {
              target: 'done',
              cond: 'isRequestBuffered',
              actions: 'respondPromise', // assert no prior responses
            },
            { target: 'respondFromBuffer', cond: 'isRequestFromBuffer' },
            { target: 'done', cond: 'isResponseDone' },
            { target: 'done', cond: 'isPending', actions: 'respondPromise' },
            { target: 'done', actions: 'respondRequest' },
          ],
        },
        respondFromBuffer: {
          // if this was pulled from the buffer, check if it responded, else default respond
          entry: 'shiftBuffer',
          always: [
            { target: 'done', cond: 'isResponseFromActions' },
            { target: 'done', cond: 'respondRequest' },
          ],
        },
        done: { type: 'final' },
      },
      onDone: [
        { target: 'done', cond: 'isSelfExhausted' },
        { target: 'reduce', actions: 'loadSelfAnvil' },
      ],
    },
  },
}

const machine = Machine(definition)

if (typeof module === 'object') {
  module.exports = { definition, machine }
}
