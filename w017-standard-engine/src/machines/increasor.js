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
    lock: undefined,
    nextLock: undefined,
    block: undefined,
    nextDmz: undefined,
    txInterblocks: [],
    containerId: '',
    isRedriveRequired: false,
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
        onError: 'error',
      },
    },
    execute: {
      // TODO move to 'onDone' style
      initial: 'branch',
      states: {
        branch: {
          always: [
            { target: 'proposeNext', cond: 'isProposer' },
            { target: 'validateNext', cond: 'isValidator' },
            { target: '#done' },
          ],
        },
        proposeNext: {
          initial: 'branch',
          states: {
            branch: {
              always: [
                // TODO check if dmz has increased after applying interblocks or not
                {
                  target: 'isDmzChanged',
                  cond: 'isIsolationComplete',
                },
                { target: '#increasor.isolate' },
              ],
            },
            isDmzChanged: {
              always: [
                {
                  target: 'signBlock',
                  cond: 'isDmzChanged',
                },
                { target: '#increasor.unlockChain' },
              ],
            },
            signBlock: {
              invoke: {
                src: 'signBlock', // TODO check if the signature is valid
                onDone: {
                  target: '#increasor.unlockChain',
                  actions: 'assignBlock',
                },
                onError: '#error',
              },
            },
          },
        },
        validateNext: {
          // if pass, sign the authenticity, then store the block & transmit the authenticity
          // else antisign the authenticity, then store & transmit the authenticity
          always: [
            { target: '.signBlock', cond: 'isIsolationComplete' },
            {
              target: '#increasor.isolate',
              cond: 'isIsolationRequired',
            },
          ],
          initial: 'signBlock',
          states: {
            signBlock: {},
          },
        },
        history: {
          type: 'history',
        },
      },
    },
    isolate: {
      invoke: {
        src: 'isolatedExecution',
        onDone: {
          target: '#increasor.execute.history',
          actions: ['assignNextDmz', 'assignContainerId'],
        },
        onError: '#error',
      },
    },
    unlockChain: {
      // make the next lock, which might be the same if no block provided
      // if no block, just plain unlock
      initial: 'isNewBlock',
      states: {
        isNewBlock: {
          always: [
            {
              target: 'effects', // TODO move to unlockChain when effects moved out
              cond: 'isNewBlock',
              actions: 'reconcileLock',
            },
            { target: 'unlockChain', actions: 'repeatLock' },
          ],
        },
        effects: {
          invoke: {
            src: 'effects',
            onDone: {
              target: 'unlockChain',
              actions: 'assignIsRedriveRequired',
            },
          },
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
        {
          target: 'done',
          cond: 'isNewBlock',
          actions: 'assignTxInterblocks',
        },
        { target: 'done' },
      ],
    },

    done: {
      id: 'done',
      data: ({ txInterblocks, isRedriveRequired }) => ({
        txInterblocks,
        isRedriveRequired,
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
