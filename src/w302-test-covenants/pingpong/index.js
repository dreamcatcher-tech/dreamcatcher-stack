import api from '../../w002-api'
const types = {
  PING: `pingpong/PING`,
  PONG: `pingpong/PONG`,
}

const OTHER_ALIAS = 'other'

const actions = {
  ping: () => ({
    type: types.PING,
  }),
  pong: () => ({
    type: types.PONG,
  }),
}

const initialState = { pingCount: 0, pongCount: 0 }

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

export { types, actions, reducer }
