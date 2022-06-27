import assert from 'assert-fast'
import { Dmz } from '../../w008-ipld'
const getStateReducer = (dmz) => {
  assert(dmz instanceof Dmz)
  replyResolve(dmz.state)
}
const getState = () => ({ type: '@@CAT', payload: {} })
export { getStateReducer, getState }
