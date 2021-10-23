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
 * The interpreter runs a single action passed down from the isolator, and
 * keeps running all the resultant loopback actions until the loopback channel
 * is exhausted.
 *
 * How Pending works:
 * Origin: origin action is the request that first flipped into pending mode.
 * External: the action that came from the isolator, and is run thru the
 * interpreter until loopback is exhausted.
 * Address: replies do not have their address included, so need to know if
 * channel is still availble to shift the request that caused this reply.
 */
const definition = {
  id: 'interpreter',
  initial: 'idle',
  context: {
    isolatedTick: undefined, // function provided as initial context
    externalAction: undefined, // the initializing action
    anvil: undefined, // the current action being processed
    dmz: undefined,
    initialPending: undefined, // used to determine if lowered during execution, and if loopback requests came from buffer
    covenantAction: undefined,
    reduceRejection: undefined,
    reduceResolve: undefined,
    isExternalPromise: undefined,
    isOriginPromise: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        TICK: {
          target: 'interpret',
          actions: ['assignExternalAction', 'assignDmz', 'assignAnvil'],
        },
      },
    },
    loopback: {
      always: [
        { target: 'autoResolves', cond: 'isSelfExhausted' },
        { target: 'interpret', actions: 'loadSelfAnvil' },
      ],
    },
    interpret: {
      always: [
        { target: 'interpretDmz', cond: 'isSystem' },
        { target: 'interpretCovenant' },
      ],
    },
    interpretDmz: {
      invoke: {
        src: 'dmz',
        onDone: { target: 'loopback', actions: 'assignDirectMachine' },
      },
    },
    interpretCovenant: {
      initial: 'isPending',
      states: {
        isPending: {
          always: [
            { target: 'pending', cond: 'isPending' },
            { target: 'direct' },
          ],
        },
        pending: {
          invoke: {
            src: 'pending',
            onDone: { target: 'done', actions: 'assignDirectMachine' },
          },
        },
        direct: {
          invoke: {
            src: 'direct',
            onDone: { target: 'done', actions: 'assignDirectMachine' },
          },
        },
        done: { type: 'final' },
      },
      onDone: 'loopback',
    },
    autoResolves: {
      invoke: {
        src: 'autoResolves',
        onDone: { target: 'openPaths', actions: 'assignDirectMachine' },
      },
    },
    openPaths: {
      entry: [
        'openPaths',
        'invalidateLocalPaths',
        'removeEmptyInvalidChannels',
      ],
      always: 'done',
    },
    done: {
      entry: 'assertLoopbackEmpty',
      data: ({ dmz }) => dmz,
      type: 'final',
    },
  },
}

if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
