import assert from 'assert-fast'
import { dmzModel } from '../../w015-models'
import { replyResolve } from '../../w002-api'
const getStateReducer = (dmz) => {
  assert(dmzModel.isModel(dmz))
  replyResolve(dmz.state)
}
const getState = () => ({ type: '@@CAT', payload: {} })
export { getStateReducer, getState }
