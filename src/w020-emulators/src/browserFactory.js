const { effectorFactory } = require('./effectorFactory')
import Debug from 'debug'
const debug = Debug('interblock:browser')
const localForage = require('localforage')

const browserFactory = async (identifier) => {
  localForage.config({ name: `@dreamcatcher/interblock_${identifier}` })
  debug(`loading browser module`)
  const effector = await effectorFactory('web')
  debug(`browser client ready`)
  return effector
}

module.exports = { browserFactory }
