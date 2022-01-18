import { consistencySourceFactory } from './consistencySourceFactory'
import { toFunctions, fromFunctions } from './queueToFunctions'
import { dbFactory } from './dbFactory'

const consistencyFactory = (rxdb, identifier) => {
  const consistencySource = consistencySourceFactory(rxdb, identifier)
  const consistencyProcessor = fromFunctions(consistencySource)
  return consistencyProcessor
}

export { consistencyFactory, toFunctions, consistencySourceFactory, dbFactory }
