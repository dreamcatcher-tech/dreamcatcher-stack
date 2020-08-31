const { metrologyFactory } = require('../../w017-standard-engine')
const { hyper } = require('../../w212-system-covenants')
const awsFactory = async (identifier = 'aws', reifiedCovenantMap) => {
  reifiedCovenantMap = { ...reifiedCovenantMap, hyper }
  const engine = await metrologyFactory(identifier, reifiedCovenantMap)
  const { sqsTx, sqsRx } = engine.getEngine()
  const hyperAddress = engine.getState().provenance.getAddress()
  await engine.settle()
  return { sqsTx, sqsRx, hyperAddress, engine }
}

module.exports = { awsFactory }
