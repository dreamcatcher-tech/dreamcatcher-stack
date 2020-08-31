const { effectorFactory } = require('./effectorFactory')
const debug = require('debug')('interblock:browser')
const localForage = require('localforage')

const browserFactory = async (identifier) => {
  localForage.config({ name: `@dreamcatcher/interblock_${identifier}` })
  debug(`loading browser module`)
  const effector = await effectorFactory('web')
  debug(`browser client ready`)
  return effector

  ioConsistency.setProcessor(consistencyFactory(dynamoDb, s3, lockName))
}

module.exports = { browserFactory }
