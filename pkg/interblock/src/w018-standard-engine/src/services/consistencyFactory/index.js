import { consistencySourceFactory } from './consistencySourceFactory'
import { toFunctions, fromFunctions } from './queueToFunctions'
import { ramDynamoDbFactory } from './ramDynamoDbFactory'
import { ramS3Factory } from './ramS3Factory'
import { s3Keys } from './s3Factory'
import { dbFactory } from './dbFactory'

const consistencyFactory = (dynamoDb, s3Base, awsRequestId) => {
  const consistencySource = consistencySourceFactory(
    dynamoDb,
    s3Base,
    awsRequestId
  )
  const consistencyProcessor = fromFunctions(consistencySource)
  return consistencyProcessor
}

export {
  consistencyFactory,
  toFunctions,
  ramDynamoDbFactory,
  ramS3Factory,
  consistencySourceFactory,
  s3Keys,
  dbFactory,
}
