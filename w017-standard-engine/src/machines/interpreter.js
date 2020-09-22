/**
 * Interpreter is responsible for:
 *  1. running the covenants
 *  2. managing their filesystem requests
 *  3. responding to requests
 *  4. marshalling all the DMZ interactions
 *
 * Filesystem: all we have is sendParent, and we want to get to send() so other side can reply()
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
            { target: 'reduceCovenant' },
          ],
        },
        reduceSystem: {
          invoke: {
            src: 'reduceSystem',
            onDone: 'done',
            onError: 'error',
          },
        },
        reduceCovenant: {
          invoke: {
            // TODO test the actions are allowed actions
            src: 'reduceCovenant',
            onDone: 'done',
            onError: 'error',
          },
        },
        error: {
          type: 'final',
          entry: 'assignRejection',
        },
        done: {
          type: 'final',
          entry: 'assignResolve',
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
            { target: 'mergeSystem', cond: 'isSystem' },
            { target: 'mergeCovenant' },
          ],
        },
        // TODO check actions are correct, else throw
        mergeSystem: {
          entry: 'mergeSystem',
          type: 'final',
        },
        mergeCovenant: {
          // insert the modified state back in to the context, after extracting the actions
          entry: 'mergeCovenant',
          type: 'final',
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
            { target: 'respondReply', cond: 'isReply' },
            { target: 'respondRejection', cond: 'isRejection' },
            { target: 'done', cond: 'isResponseDone' },
            { target: 'respondRequest' },
          ],
        },
        respondReply: { entry: 'respondReply', type: 'final' },
        respondRejection: {
          // one of lifes great challenges
          entry: 'respondRejection',
          type: 'final',
        },
        respondRequest: {
          entry: 'respondRequest',
          type: 'final',
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
