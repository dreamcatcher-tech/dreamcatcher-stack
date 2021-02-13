const assert = require('assert')
const { dmzModel } = require('../../w015-models')
const { replyResolve } = require('../../w002-api')
const getStateReducer = (dmz) => {
  assert(dmzModel.isModel(dmz))
  replyResolve(dmz.state)
}
const getState = () => ({ type: '@@CAT', payload: {} })
module.exports = { getStateReducer, getState }
