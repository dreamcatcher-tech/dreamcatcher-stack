/**
 * Machine that can be analyzed by the visualizer: https://xstate.js.org/viz/
 *
 * What does the increasor do ?
 *    1. lock the chain, so only one pubkey and chainId increasor is operating at any time
 *    2. stores the consensus intermediate states
 *    3. stores the consensus final states - ie: blocks
 *    4. derives all the interblocks and asks net to distribute them
 *    5. Generates the next dmz out of current dmz + interblocks
 *    6. Ticks the dmz machine forwards to produce the next dmz
 *    7. Manages the children of the chains it runs with create and destroy
 *
 *
 * Optionally isolation can be invoked to allow side effects.
 * This will cause the promise mechanism of xstate to be operated upon.
 */
const definition = {
  id: 'increasor',
  initial: 'idle',
  context: {
    cache: new Map(),
    lock: undefined,
    nextLock: undefined,
    block: undefined,
    nextDmz: undefined,
    txInterblocks: [],
    containerId: '',
    isRedriveRequired: false,
    cachedDmz: undefined,
    turnoverHeights: [],
    turnoverBlocks: {},
  },
  strict: true,
  states: {
    idle: {
      on: {
        INCREASE_CHAIN: 'lockChain',
      },
    },
    lockChain: {
      invoke: {
        src: 'lockChain', // put in timeout so we release and stop running
        onDone: [
          {
            target: 'execute',
            cond: 'isLockAcquired',
            actions: 'assignLock',
          },
          { target: 'done' },
        ],
      },
    },
    execute: {
      initial: 'isProposer',
      states: {
        isProposer: {
          always: [
            { target: 'proposeNext', cond: 'isProposer' },
            { target: 'validateNext', cond: 'isValidator' },
            { target: 'done' },
          ],
        },
        proposeNext: {
          initial: 'isIncreasable',
          states: {
            isIncreasable: {
              always: [
                { target: 'reviveCache', cond: 'isIncreasable' },
                { target: 'done' },
              ],
            },
            reviveCache: {
              always: [
                { target: 'isIsolationComplete', cond: 'isCacheEmpty' },
                { target: 'isIsolationComplete', actions: 'reviveCache' },
              ],
            },
            isIsolationComplete: {
              always: [
                { target: 'isDmzTransmitting', cond: 'isIsolationComplete' },
                { target: 'isolate' },
              ],
            },
            isolate: {
              // TODO bypass covenant loading when system actions only
              invoke: {
                src: 'isolatedExecution',
                onDone: {
                  target: 'isIsolationComplete',
                  actions: ['assignNextDmz', 'assignContainerId'],
                },
              },
            },
            isDmzTransmitting: {
              always: [
                { target: 'signBlock', cond: 'isDmzTransmitting' },
                { target: 'done' },
              ],
            },
            signBlock: {
              invoke: {
                src: 'signBlock',
                onDone: { target: 'done', actions: 'assignBlock' },
              },
            },
            done: { type: 'final' },
          },
          onDone: 'done',
        },
        validateNext: {
          // if pass, sign the authenticity, then store the block & transmit the authenticity
          // else antisign the authenticity, then store & transmit the authenticity
        },
        done: { type: 'final' },
      },
      onDone: 'unlockChain',
    },
    unlockChain: {
      initial: 'isNewBlock',
      states: {
        isNewBlock: {
          always: [
            {
              target: 'effects', // TODO transition to unlockChain when effects moved out
              cond: 'isNewBlock',
              actions: ['reconcileLock', 'clearCache'],
            },
            { target: 'isNextDmz', actions: 'repeatLock' },
          ],
        },
        isNextDmz: {
          always: [
            { target: 'unlockChain', cond: 'isNoNextDmz' },
            { target: 'unlockChain', actions: 'cachePartial' },
          ],
        },
        effects: {
          initial: 'isEffectable',
          states: {
            isEffectable: {
              always: [
                { target: 'executeEffects', cond: 'isEffectable' },
                { target: 'done' },
              ],
            },
            executeEffects: {
              invoke: {
                src: 'effects',
                onDone: {
                  target: 'done',
                  actions: 'assignIsRedriveRequired',
                },
              },
            },
            done: { type: 'final' },
          },
          onDone: 'unlockChain',
        },
        unlockChain: {
          invoke: {
            src: 'unlockChain',
            onDone: 'done',
          },
        },
        done: {
          type: 'final',
        },
      },
      onDone: [
        { target: 'txInterblocks', cond: 'isNewBlock' },
        { target: 'done' },
      ],
    },
    txInterblocks: {
      entry: 'calculateTurnoverHeights',
      invoke: {
        src: 'fetchTurnoverBlocks',
        onDone: {
          target: 'done',
          actions: ['assignTurnoverBlocks', 'assignTxInterblocks'],
        },
      },
    },
    done: {
      data: ({ txInterblocks, isRedriveRequired }) => ({
        txInterblocks,
        isRedriveRequired,
      }),
      type: 'final',
    },
  },
}
if (typeof Machine === 'function') {
  Machine(definition)
}
export default definition
