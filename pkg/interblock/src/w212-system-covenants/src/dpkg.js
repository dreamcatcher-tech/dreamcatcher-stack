/**
 * Chain representing an application package of any kind.
 * Covenants are subset of all possible package.
 * Covenants can be written in any language.
 * Config files are present in some covenants, which specify multiple chains.
 * Calling install on a dpkg will do different things base on the environment:
 * 1. DOS will cause either default config applied, or covenant config to be used
 * 2. Linux will cause the package manager to install an image
 */
import Debug from 'debug'
const debug = Debug('interblock:covenants:dpkg')
import { replyResolve } from '../../w002-api'
import { covenantIdModel } from '../../w015-models'
const covenantId = covenantIdModel.create('dpkg')

const reducer = async (state, action) => {
  // TODO verify the state against schema
  switch (action.type) {
    case 'GET_INSTALL': {
      debug('getInstaller')
      // TODO return default, pointing to its own reducer, if no installer
      replyResolve(state.installer || {})
      return state
    }
    case 'SET_INSTALL': {
      debug(`SET_INSTALL`)
    }
  }
  return state
}

const actions = {
  setInstaller: () => ({ type: 'SET_INSTALL' }),
  getInstaller: () => ({ type: 'GET_INSTALL' }),
}

export { reducer, actions, covenantId }
