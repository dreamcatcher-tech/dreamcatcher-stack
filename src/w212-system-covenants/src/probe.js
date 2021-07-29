/**
 * Stub for the probe covenant, which will eventually
 * exercise the entire system from within.
 */
import Debug from 'debug'
const debug = Debug('interblock:covenants:probe')

const { replyResolve, request } = require('../../w002-api')
const { actions } = require('../../w021-dmz-reducer')

const initialState = {}
const probe = {
  reducer: async (state = initialState, action) => {
    const { type, payload } = action
    debug(`test action: `, type)
    switch (type) {
      case 'PING':
        replyResolve({ type: 'PONG', payload })
        break
    }
    return { ...state }
  },
  actions: {},
}

module.exports = { ...probe }
