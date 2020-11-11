/**
 * The hypercomputer.
 * At the base of AWS is the first hypercomputer.
 * To connect, you join with the authenticator, then expand your permissions.
 * This will grant you a terminal, which you can use to start your own hypercomputer.
 *
 * Hypercomputers are recursive, and they can be reprogrammed with an application.
 *
 * Structure:
 *
 * /
 *      authenticator / firewall
 *      terminals
 *      filesApp
 *      someOtherApp
 *      hypercomputers
 *          hyper1
 *          hyper2
 */
const debug = require('debug')('interblock:covenants:hyper')

const { replyResolve, request } = require('../../w002-api')
const { actions } = require('../../w021-dmz-reducer')

const initialState = {}
const hyper = {
  reducer: async (state = initialState, action) => {
    debug(`hyper action: `, action.type)
    switch (action.type) {
      case 'PING':
        replyResolve({ type: 'PONG' })
        break
    }
    return { ...state }
  },
  actions: {},
}

module.exports = { ...hyper }
