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
import { replyResolve } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:covenants:hyper')

const initialState = {}
const reducer = async (state = initialState, action) => {
  debug(`hyper action: `, action)
  const { type, payload } = action
  switch (type) {
    case 'PING':
      replyResolve({ type: 'PONG', payload })
      break
  }
  return { ...state }
}
const actions = {}

export { reducer, actions }
