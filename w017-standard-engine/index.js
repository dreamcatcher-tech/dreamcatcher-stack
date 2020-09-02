const { metrologyFactory } = require('./src/metrologyFactory')
const { standardEngineFactory } = require('./src/standardEngineFactory')
const {
  consistencyFactory,
  toFunctions,
} = require('./src/services/consistencyFactory')
const { cryptoFactory } = require('./src/services/cryptoFactory')
const { blockPrint } = require('./src/execution/printer')
const { setLogger } = require('./src/execution/thread')
module.exports = {
  metrologyFactory,
  standardEngineFactory,
  consistencyFactory,
  cryptoFactory,
  blockPrint,
  setLogger,
  consistencyQueueToFunctions: toFunctions,
}
