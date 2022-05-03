import assert from 'assert-fast'
import { Dmz } from '../../w015-models'
import { replyResolve } from '../../w002-api'
const getStateReducer = (dmz) => {
  assert(dmz instanceof Dmz)
  replyResolve(dmz.state)
}
const getState = () => ({ type: '@@CAT', payload: {} })
export { getStateReducer, getState }
