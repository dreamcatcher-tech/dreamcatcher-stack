import { effectorFactory } from './effectorFactory'
import localForage from 'localforage'
import Debug from 'debug'
const debug = Debug('interblock:browser')
// TODO delete this as not needed ?
const browserFactory = async (identifier) => {
  localForage.config({ name: `@dreamcatcher/interblock_${identifier}` })
  debug(`loading browser module`)
  const effector = await effectorFactory('web')
  debug(`browser client ready`)
  return effector
}

export { browserFactory }
