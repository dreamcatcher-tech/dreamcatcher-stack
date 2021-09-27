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
    interblock: undefined,
    containerId: undefined,
    isolation: () => 'isolation function',
    pierceDmz: undefined,
    hasPierced: false,
  },
  strict: true,
  states: {
    idle: {
      on: {
        EXECUTE_COVENANT: {
          target: 'isGenesis',
          actions: ['assignLock', 'assignDmz'],
        },
      },
    },
    isGenesis: {
      always: [
        { target: 'attachParentLineage', cond: 'isGenesis' },
        { target: 'isDmzChangeable' },
      ],
    },
    attachParentLineage: {
      entry: ['assignGenesisInterblock', 'connectToParent'],
      invoke: {
        src: 'fetchParentLineage',
        // TODO handle lineage check fail ? or just throw
        onDone: { target: 'isDmzChangeable', cond: 'verifyLineage' },
      },
      exit: 'ingestParentLineage',
    },
    isDmzChangeable: {
      entry: 'ingestInterblocks',
      always: [
        { target: 'loadCovenant', cond: 'isDmzChangeable' },
        { target: 'done' },
      ],
    },
    loadCovenant: {
      invoke: {
        src: 'loadCovenant',
        onDone: { target: 'isReduceable', actions: 'assignContainerId' },
        onError: 'error',
      },
    },
    isReduceable: {
      always: [
        // check if the message system is enabled, enable if so
        { target: 'reduce', cond: 'isReduceable' },
        { target: 'pierce', cond: 'isPiercable' },
        { target: 'isCovenantUnloadable' },
        // disable the messaging system if it was enabled
      ],
    },
    reduce: {
      // TODO run repeatedly with timer, sending updates to parent each time
      invoke: {
        src: 'reduce',
        onDone: { target: 'isReduceable', actions: 'updateDmz' },
        onError: 'error',
      },
    },
    pierce: {
      initial: 'generatePierceDmz',
      states: {
        generatePierceDmz: {
          entry: ['assignHasPierced', 'generatePierceDmz'],
          always: [
            { target: 'signPierceDmz', cond: 'isPierceDmzChanged' },
            { target: 'signPierceDmz', cond: 'isPierceChannelUnopened' },
            { target: 'done' },
          ],
        },
        signPierceDmz: {
          invoke: {
            src: 'signPierceDmz',
            onDone: {
              target: 'done',
              actions: ['openPierceChannel', 'ingestPierceBlock'],
            },
          },
        },
        done: {
          type: 'final',
        },
      },
      onDone: 'isReduceable',
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