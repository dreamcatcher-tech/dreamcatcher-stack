/**
 * Make a covenant and have it live loaded in the browser.
 * Need a way to use the same code to work in production.
 */
import Debug from 'debug'
const debug = Debug('covenant')
const reducer = (state = {}, action) => {
  debug('reducer', action)
  return state
}
const actions = {
  ping: (...args) => ({ type: 'PING', payload: { args } }),
}
export default { reducer, actions }
