/**
 * Stub for the probe covenant, which will eventually
 * exercise the entire system from within.
 */

import { CovenantId } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:covenants:probe')
const covenantId = CovenantId.create('probe')

const initialState = {}
const reducer = async (state = initialState, action) => {
  const { type, payload } = action
  debug(`test action: `, type)
  switch (type) {
    case 'PING':
      replyResolve({ type: 'PONG', payload })
      break
  }
  return { ...state }
}
const actions = {}

export { reducer, actions, covenantId }
