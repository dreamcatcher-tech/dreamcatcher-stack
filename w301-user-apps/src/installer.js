/**
 * A reducer that expects to receive an '@@INSTALL' command
 */
const { interchain } = require('../../w002-api')

const reducer = async (state, action) => {
  switch (action.type) {
    case '@@INSTALL':
      break
  }
  return state
}

const covenantId = { name: 'installer' }
const actions = { install: () => ({ type: '@@INSTALL' }) }
const installer = { reducer, covenantId, actions }
module.exports = { installer }
