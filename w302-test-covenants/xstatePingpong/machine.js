const actions = {
  ping: () => ({
    type: `pingpong/PING`,
  }),
  pong: () => ({
    type: `pingpong/PONG`,
  }),
}

const initialState = { pingCount: 0, pongCount: 0 }

/**
 * Purpose:
 * 1. Show ping pong between chains using filesystem for alias resolution.
 * 2. Show deployment based on config.
 * 3. Show promises in operation
 * 4. Explore the returned state, for interpretation
 * 5. Run the dmz name resolution loop
 */

// Available variables:
// - Machine
// - interpret
// - assign
// - send
// - sendParent
// - spawn
// - raise
// - actions
// - XState (all XState exports)

const pingpongMachine = Machine({
  id: 'pingpong',
  initial: 'idle',
  states: {
    idle: {
      on: {
        START: 'start',
        PING: 'ping',
        PONG: 'pong',
      },
    },
    start: {
      invoke: {
        src: () => {
          // send a ping to the pong machine
        },
        onDone: 'idle',
      },
    },
    ping: {
      // entry: respond('PONG'),
      on: {
        '': 'idle',
      },
    },
  },
})

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.PING: {
      const nextState = { ...state, pingCount: state.pingCount + 1 }
      return api.send(
        nextState,
        api.actions.write({
          alias: OTHER_ALIAS,
          action: actions.pong(),
          options: {
            await: true,
          },
        })
      )
    }

    case types.PONG: {
      const nextState = { ...state, pongCount: state.pongCount + 1 }
      return api.send(
        nextState,
        api.actions.update({
          responseType: api.constants.promise.RESOLVE,
          response: 'ponged the ping',
        })
      )
    }
    default:
      return state
  }
}

module.exports = {
  actions,
  reducer,
}

import { Machine, interpret, send, sendParent } from 'xstate'

// Parent machine
const pingMachine = Machine({
  id: 'ping',
  initial: 'active',
  states: {
    active: {
      invoke: {
        id: 'pong',
        src: pongMachine,
      },
      // Sends 'PING' event to child machine with ID 'pong'
      entry: send('PING', { to: 'pong' }),
      on: {
        PONG: {
          actions: send('PING', {
            to: 'pong',
            delay: 1000,
          }),
        },
      },
    },
  },
})

// Invoked child machine
const pongMachine = Machine({
  id: 'pong',
  initial: 'active',
  states: {
    active: {
      on: {
        PING: {
          // Sends 'PONG' event to parent machine
          actions: sendParent('PONG', {
            delay: 1000,
          }),
        },
      },
    },
  },
})

const service = interpret(pingMachine).start()
