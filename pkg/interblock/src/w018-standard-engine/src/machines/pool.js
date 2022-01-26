/**
 * The network supplies the special ability to contact other instances
 * through the resource of transmission.  The network handles external
 * addressing, so that virtual chain addresses can find physical
 * machine addresses.
 *
 * It manages blacklisting, throttling, and will expand out to discovery
 * and DHT maintenance with other nodes.  Refetching missing interblocks is handled
 * here.
 *
 * What does the network do?
 *    1. pool interblocks while storing their socket info
 *    2. reject events because of blacklisted socket info or incorrect formats
 *    3. request retransmission of missing interblocks, while ignoring repeat requests
 *    4. relays interblocks to other validators
 *
 * loop breaking is that interblocks only sent when something of interest has changed
 * means that next change, provenance of all skips must be sent too.
 * If nothing changed since last transmission, only provenance is sent.
 *
 * Network receives interblocks with socket info attached, and returns pure interblocks or null.
 * Null means this interblock is to be discarded.
 * When pooling an interblock, the refetch mechanism may have been triggered, resulting in
 * interblocks being transmitted from the system.
 *
 */

const definition = {
  id: 'pool',
  initial: 'idle',
  context: {
    interblock: undefined,
    lock: undefined,
    dmz: undefined,
    baseDmz: undefined,
    validators: undefined,
    isPooled: false,
    targetBlock: undefined,
  },
  strict: true,
  states: {
    idle: {
      on: {
        POOL_INTERBLOCK: {
          target: 'initializeStorage',
          actions: 'assignInterblock',
        },
      },
    },
    done: {
      data: ({ isPooled }) => ({ isPooled }), // did this interblock get pooled
      type: 'final',
    },
    initializeStorage: {
      invoke: {
        src: 'initializeStorage',
        onDone: [
          { target: 'done', cond: 'isInitialConditions' },
          { target: 'processInterblock' },
        ],
      },
    },
    processInterblock: {
      initial: 'isGenesis',
      states: {
        done: { type: 'final' },
        isGenesis: {
          always: [
            { target: 'birthChild', cond: 'isGenesis' },
            { target: 'poolInterblock' },
          ],
        },
        poolInterblock: {
          initial: 'fetchTargetBlock',
          states: {
            fetchTargetBlock: {
              // TODO speed up for genesis as can avoid the db hit
              invoke: { src: 'fetchTargetBlock', onDone: 'isPoolable' },
            },
            isPoolable: {
              entry: 'assignTargetBlock',
              always: [
                // TODO check the signatures on the interblock
                { target: 'done', cond: 'isTargetBlockMissing' },
                { target: 'storeInPool', cond: 'isGenesis' },
                { target: 'storeInPool', cond: 'isAddable' },
                { target: 'storeInPool', cond: 'isConnectable' },
                { target: 'done' },
              ],
            },
            storeInPool: {
              invoke: {
                src: 'storeInPool',
                onDone: { target: 'done', actions: 'assignIsPooled' },
              },
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        birthChild: {
          initial: 'checkIsOriginPresent',
          states: {
            checkIsOriginPresent: {
              invoke: {
                src: 'checkIsOriginPresent',
                onDone: [
                  { target: 'lockChildChain', cond: 'isOriginPresent' },
                  { target: 'done' },
                ],
              },
            },
            done: {
              type: 'final',
            },
            lockChildChain: {
              entry: 'unassignLock',
              invoke: {
                src: 'lockChildChain', // TODO move to unified services ?
                onDone: [
                  { target: 'done', cond: 'isLockFailed' },
                  { target: 'increaseGenesisChain' },
                ],
              },
            },
            increaseGenesisChain: {
              entry: 'assignLock',
              always: [
                { target: 'unlockChain', cond: 'isBirthingCompleted' },
                { target: 'mergeGenesis' },
              ],
            },
            mergeGenesis: {
              entry: ['mergeGenesis', 'mergeBlockToLock'],
              always: 'unlockChain',
            },
            unlockChain: {
              // TODO use a renewable lock
              invoke: {
                src: 'unlockChain',
                onDone: 'done',
              },
            },
          },
          onDone: 'poolInterblock',
        },
      },
      onDone: 'done',
    },
  },
}
if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
