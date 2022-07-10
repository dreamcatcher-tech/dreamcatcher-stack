/**
 * The base of all application installs.
 * Created by the installer based on a dpkg
 */

import { CovenantId } from '../../w015-models'

const reducer = (state = {}) => {
  return state
}
const covenantId = CovenantId.create('app')

export { reducer, covenantId }
