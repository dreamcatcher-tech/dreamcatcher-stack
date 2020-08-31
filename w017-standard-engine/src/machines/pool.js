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
    nextBlock: undefined,
    affectedAddresses: [],
    baseDmz: undefined,
    validators: undefined,
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
      id: 'done',
      data: ({ affectedAddresses }) => affectedAddresses,
      type: 'final',
    },
    initializeStorage: {
      // TODO merge service calls with genesis creation
      initial: 'isStorageEmpty',
      states: {
        isStorageEmpty: {
          invoke: {
            src: 'isStorageEmpty',
            onDone: [
              {
                target: 'fetchValidatorKey',
                cond: 'isStorageEmpty',
              },
              { target: 'done' },
            ],
          },
        },
        // TODO lock special chainId 'SYSTEM_INIT'
        // never give this lock out again unless the db is empty
        fetchValidatorKey: {
          invoke: {
            src: 'fetchValidatorKey',
            onDone: {
              target: 'createBaseBlock',
              actions: 'assignValidatorKey',
            },
          },
        },
        createBaseBlock: {
          entry: 'createBaseDmz',
          invoke: {
            src: 'signBlock',
            onDone: {
              target: 'lockBaseChain',
              actions: 'assignGeneratedBlock',
            },
          },
        },
        lockBaseChain: {
          invoke: {
            src: 'lockBaseChain',
            onDone: {
              target: 'unlockChain',
              actions: 'assignLock',
            },
          },
        },
        unlockChain: {
          entry: 'mergeBlockToLock',
          invoke: {
            src: 'unlockChain',
            onDone: {
              target: 'done',
              actions: 'assignInitializedAddress',
            },
          },
        },
        done: { type: 'final' },
      },
      onDone: 'poolInterblock',
    },
    poolInterblock: {
      initial: 'isGenesis',
      states: {
        isGenesis: {
          always: [
            { target: 'birthChild', cond: 'isGenesis' },
            { target: 'poolAffectedChains' },
          ],
        },
        poolAffectedChains: {
          initial: 'fetchAffectedAddresses',
          states: {
            fetchAffectedAddresses: {
              invoke: {
                src: 'fetchAffectedAddresses',
                onDone: [
                  {
                    target: 'isConnectionAttempt',
                    actions: 'assignAffectedAddresses',
                  },
                ],
              },
            },
            isConnectionAttempt: {
              always: [
                { target: 'done', cond: 'isStorageEmpty' },
                {
                  target: 'isConnectable',
                  cond: 'isConnectionAttempt',
                },
                { target: 'storeInPools' },
              ],
            },
            isConnectable: {
              // TODO check if we hold this address first ?
              invoke: {
                src: 'isConnectable',
                onDone: [
                  {
                    target: 'storeInPools',
                    cond: 'isConnectable',
                    actions: 'assignConnectionAttempt',
                  },
                  { target: 'storeInPools' },
                ],
              },
            },
            storeInPools: {
              invoke: {
                src: 'storeInPools',
                onDone: { target: 'done' },
              },
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        done: { type: 'final' },
        birthChild: {
          initial: 'checkIsOriginPresent',
          states: {
            checkIsOriginPresent: {
              invoke: {
                src: 'checkIsOriginPresent',
                onDone: [
                  {
                    target: 'lockChildChain',
                    cond: 'isOriginPresent',
                  },
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
                  { target: 'increaseChain' },
                ],
              },
            },
            increaseChain: {
              entry: ['assignLock', 'assignDmz', 'assignNextBlock'],
              always: [
                {
                  target: 'unlockChain',
                  cond: 'isBirthingCompleted',
                },
                {
                  target: 'fetchParentLineage',
                  cond: 'isLockForGenesis',
                },
                { target: 'mergeGenesis' },
              ],
            },
            mergeGenesis: {
              entry: 'mergeGenesis',
              always: 'unlockChain',
            },
            fetchParentLineage: {
              entry: 'connectToParent',
              invoke: {
                src: 'fetchParentLineage',
                // TODO handle lineage check fail ? or just throw
                onDone: {
                  target: 'generateBirthBlock',
                  cond: 'verifyLineage',
                },
              },
              exit: 'ingestParentLineage',
            },
            generateBirthBlock: {
              invoke: {
                src: 'generateBirthBlock',
                onDone: {
                  target: 'unlockChain',
                  actions: 'assignGeneratedBlock',
                },
              },
            },
            unlockChain: {
              // TODO use a renewable lock
              entry: 'mergeBlockToLock',
              invoke: {
                src: 'unlockChain',
                onDone: [
                  {
                    target: 'lockChildChain',
                    cond: 'isLockForGenesis',
                  },
                  {
                    target: 'poolBirthBlock',
                    cond: 'isLockForBirthBlock',
                  },
                  { target: 'done' },
                ],
              },
            },
            poolBirthBlock: {
              invoke: {
                src: 'poolBirthBlock',
                onDone: 'done',
              },
            },
          },
          onDone: 'poolAffectedChains',
        },
      },
      onDone: 'done',
    },

    error: {
      id: 'error',
      type: 'final',
    },
  },
}
const machine = Machine(definition)
if (typeof module === 'object') {
  module.exports = { definition, machine }
}
