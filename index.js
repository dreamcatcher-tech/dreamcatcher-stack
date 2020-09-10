const {
  browserFactory,
  effectorFactory,
  awsFactory,
} = require('./w020-emulators')
const engine = require('./w017-standard-engine')

module.exports = { browserFactory, effectorFactory, awsFactory, engine }
