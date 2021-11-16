import { consistencySourceFactory } from './consistencySourceFactory'
import { toFunctions, fromFunctions } from './queueToFunctions'
import { dbFactory } from './dbFactory'

const consistencyFactory = (leveldb, identifier) => {
  const consistencySource = consistencySourceFactory(leveldb, identifier)
  const consistencyProcessor = fromFunctions(consistencySource)
  return consistencyProcessor
}

export { consistencyFactory, toFunctions, consistencySourceFactory, dbFactory }
