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
 *
 * The isolator talks to the container subsystem, and is capable of ending any
 * container for any reason.
 * The isolator manages requests from inside containers for reading blocks.
 * ContainerId is related to a loaded covenant and a blockhash.
 */
const definition = {
  id: 'isolator',
  initial: 'idle',
  context: {
    lock: undefined,
    dmz: undefined,
    interblocks: undefined,
    containerId: undefined,
    isolation: () => 'isolated execution function',
    pierceDmz: undefined,
    pierceBlock: undefined,
    rxIndex: 0,
    rxAction: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        EXECUTE_COVENANT: {
          target: 'isPierceable',
          actions: ['assignLock', 'assignDmz', 'assignInterblocks'],
        },
      },
    },
    isPierceable: {
      entry: 'blankPiercings',
      always: [
        { target: 'pierce', cond: 'isPierceable' },
        { target: 'isGenesis' },
      ],
    },
    isGenesis: {
      always: [
        {
          target: 'ingestInterblocks',
          cond: 'isGenesis',
          // TODO make connection happen in the parent itself
          actions: ['connectToParent'],
        },
        { target: 'ingestInterblocks' },
      ],
    },
    ingestInterblocks: {
      entry: ['zeroTransmissions', 'ingestInterblocks'],
      always: 'loadCovenant',
    },
    loadCovenant: {
      invoke: {
        src: 'loadCovenant',
        onDone: { target: 'exhaust', actions: 'assignContainerId' },
      },
    },
    exhaust: {
      initial: 'isReduceable',
      states: {
        isReduceable: {
          entry: 'selectAction',
          always: [
            // check if the isolation message system is enabled, enable if so
            {
              target: 'reduce',
              cond: 'isReduceable',
              actions: 'incrementRxIndex',
            },
            { target: 'done' },
            // disable the messaging system if it was enabled
          ],
        },
        reduce: {
          // TODO run repeatedly with timer, sending updates to parent each time
          invoke: {
            src: 'reduce',
            onDone: { target: 'isReduceable', actions: 'updateDmz' },
          },
        },
        done: { type: 'final', entry: 'zeroLoopback' },
      },
      onDone: 'isCovenantUnloadable',
    },

    pierce: {
      initial: 'generatePierceDmz',
      states: {
        generatePierceDmz: {
          entry: [
            'generatePierceDmz',
            'generatePierceBlock',
            'pushPierceInterblock',
            'injectReplayablePiercings',
          ],
          always: 'isPierceChannelUnopened',
        },
        isPierceChannelUnopened: {
          always: [
            {
              target: 'done',
              cond: 'isPierceChannelUnopened',
              actions: 'openPierceChannel',
            },
            { target: 'done' },
          ],
        },
        done: {
          type: 'final',
        },
      },
      onDone: 'isGenesis',
    },
    isCovenantUnloadable: {
      always: [
        // do not unload if exec() functions will be called after blocking
        { target: 'done', cond: 'isCovenantEffectable' },
        { target: 'unloadCovenant' },
      ],
    },
    unloadCovenant: {
      invoke: {
        src: 'unloadCovenant',
        onDone: { target: 'done', actions: 'unassignContainerId' },
        onError: 'error',
      },
    },
    done: {
      // TODO tear down the isolation container, or close out promises
      // TODO stop if time has passed

      data: ({ dmz, containerId }) => ({ dmz, containerId }),
      type: 'final',
    },
    error: {
      type: 'final',
    },
  },
}
if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
