import { metrologyFactory } from '../../w018-standard-engine'
import { hyper } from '../../w212-system-covenants'
const awsFactory = async (identifier = 'aws', reifiedCovenantMap) => {
  reifiedCovenantMap = { ...reifiedCovenantMap, hyper }
  const engine = await metrologyFactory(identifier, reifiedCovenantMap)
  const { sqsTx, sqsRx } = engine.getEngine()
  const hyperAddress = engine.getState().provenance.getAddress()
  await engine.settle()
  return { sqsTx, sqsRx, hyperAddress, engine }
}

export { awsFactory }
