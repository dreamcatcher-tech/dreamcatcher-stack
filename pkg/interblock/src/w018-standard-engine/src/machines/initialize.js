const definition = {
  id: 'pool.initialize',
  initial: 'idle',
  strict: true,
  context: { isInitialConditions: false, systemInitUuid: undefined },
  states: {
    idle: { on: { INITIALIZE: 'isStorageEmpty' } },
    isStorageEmpty: {
      invoke: {
        src: 'isStorageEmpty',
        onDone: [
          {
            target: 'lockSystemInit',
            cond: 'isStorageEmpty',
          },
          { target: 'done' },
        ],
      },
    },
    lockSystemInit: {
      invoke: {
        // never give this lock out again unless the db is empty
        src: 'lockSystemInit',
        onDone: [
          {
            target: 'fetchValidatorKey',
            cond: 'isSystemInitLocked',
            actions: 'assignSystemInitUuid',
          },
          // TODO wait for base chain to be created, or wait for lock to expire
          { target: 'done' },
        ],
      },
    },
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
      always: { target: 'lockBaseChain', actions: 'assignBaseBlock' },
    },
    lockBaseChain: {
      invoke: {
        src: 'lockBaseChain',
        onDone: {
          target: 'unlockSystemInit',
          actions: ['assignLock', 'mergeBlockToLock'],
        },
      },
    },
    unlockSystemInit: {
      // unlock system first, so no base orphan if crash
      // TODO wait for base chain if there not found but system is initialized
      invoke: { src: 'unlockSystemInit', onDone: 'unlockChain' },
    },
    unlockChain: {
      invoke: {
        src: 'unlockChain',
        onDone: 'done',
      },
    },
    done: {
      data: ({ isInitialConditions }) => ({ isInitialConditions }),
      type: 'final',
    },
  },
}

if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
