// TODO handle handshaking
// dbCalls: channelsToChainsMap, getLatestBlock
// first check the target
//    get block of target
//    check if block accepts this - send thru to pooler
//    check if it is an incoming connection - send thru to pooler
//    check if catchups are needed from us - send to transmit
// then treat as lineage only, check if we have anything that needs this, except target
//    pool if needed
// check if we are being spammed

const definition = {
  id: 'receive',
  initial: 'idle',
  context: {
    socket: undefined,
    interblock: undefined,
    isPoolable: false,
    isCatchupable: false,
  },
  strict: true,
  states: {
    idle: {
      on: {
        RECEIVE_INTERBLOCK: {
          target: 'isInitialConditions',
          actions: ['assignInterblock', 'assignSocket'],
        },
      },
    },
    isInitialConditions: {
      invoke: {
        src: 'isInitialConditions',
        onDone: [
          {
            target: 'done',
            actions: 'assignIsPoolable',
            cond: 'isInitialConditions',
          },
          { target: 'isAnyAffected' },
        ],
      },
    },
    // TODO store new sockets after handshake
    // receive from anyone, transmit only to handshake proven ??
    isAnyAffected: {
      invoke: {
        src: 'isAnyAffected',
        onDone: [
          {
            target: 'storeConnection',
            actions: 'assignIsPoolable',
            cond: 'isPoolable',
          },
          { target: 'isConnectable', cond: 'isConnectionAttempt' },
          { target: 'done' },
        ],
      },
    },
    storeConnection: {
      invoke: {
        src: 'storeConnection',
        onDone: 'done',
      },
    },
    isConnectable: {
      invoke: {
        src: 'isConnectable',
        onDone: [
          {
            target: 'storeConnection',
            actions: 'assignIsPoolable',
            cond: 'isConnectable',
          },
          { target: 'done' },
        ],
      },
    },
    // TODO handle catchup detection
    // TODO store socket info for spam detection
    done: {
      data: ({ isPoolable, isCatchupable }) => ({
        isPoolable,
        isCatchupable,
      }),
      type: 'final',
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
