/**
 * Machine that can be analyzed by the visualizer: https://xstate.js.org/viz/
 *
 * The isolator supplies the quality of isolated execution.
 * It operates in two modes:
 *    1. No network block making, which forces functions to be pure
 *    2. Full network effect running, intended for impure effects
 *
 * It does as little thinking as possible, to reduce the effects of
 * the isolation boundary being jumped by malicious or badly behaved code.
 * Isolator is supplied with a dmz, a covenant reference.
 * It attaches the DMZ FSM and executes it, sending updates back each time.
 *
 * Effects are run using xstate services ?
 * Effects are run using promise invocation of named promises in a special chain ?
 * Effects are expected to be independent of each other, but we
 * attempt to invoke them in channel order.  No effects get state.
 *
 * Long running tasks need to start their own docker container and
 * run their own chain.  The promise that starts them is complete when the
 * container boots.
 * These long running tasks are like services in xstate. They take
 * place in a dedicated docker container, which might get torn down at
 * any time, so first invocation should heartbeat the chain.
 */
const definition = {
  id: 'isolator',
  initial: 'idle',
  context: {
    lock: undefined,
    dmz: undefined,
    isolation: () => 'isolation function',
    hasPierced: false,
  },
  strict: true,
  states: {
    idle: {
      on: {
        EXECUTE_COVENANT: {
          target: 'isDmzChangeable',
          actions: ['assignLock', 'primeDmz'],
        },
      },
    },
    isDmzChangeable: {
      always: [
        { target: 'loadCovenant', cond: 'isDmzChangeable' },
        { target: 'done' },
      ],
    },
    loadCovenant: {
      invoke: {
        src: 'loadCovenant',
        onDone: { target: 'isExhausted', actions: 'assignContainerId' },
        onError: 'error',
      },
    },
    isExhausted: {
      always: [
        { target: 'reduceActionless', cond: 'isPiercable' },
        { target: 'unloadCovenant', cond: 'isExhausted' },
        { target: 'reduce' },
      ],
    },
    reduce: {
      // TODO run repeatedly with timer, sending updates to parent each time
      invoke: {
        src: 'reduce',
        onDone: { target: 'isExhausted', actions: 'updateDmz' },
        onError: 'error',
      },
    },
    reduceActionless: {
      invoke: {
        src: 'reduceActionless',
        onDone: {
          target: 'isExhausted',
          actions: ['updateDmz', 'assignHasPierced'],
        },
        onError: 'error',
      },
    },
    unloadCovenant: {
      invoke: {
        src: 'unloadCovenant',
        onDone: 'done',
        onError: 'error',
      },
    },
    done: {
      // TODO tear down the isolation container, or close out promises
      // TODO stop if time has passed
      data: ({ dmz }) => dmz,
      type: 'final',
    },
    error: {
      type: 'final',
    },
  },
}
const machine = Machine(definition)
if (typeof module === 'object') {
  module.exports = { definition, machine }
}
