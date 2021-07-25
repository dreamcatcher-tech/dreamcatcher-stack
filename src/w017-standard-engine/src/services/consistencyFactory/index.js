const { consistencySourceFactory } = require('./consistencySourceFactory')
const { toFunctions, fromFunctions } = require('./queueToFunctions')
const { ramDynamoDbFactory } = require('./ramDynamoDbFactory')
const { ramS3Factory } = require('./ramS3Factory')
const { s3Keys } = require('./s3Factory')
const { dbFactory } = require('./dbFactory')

const consistencyFactory = (dynamoDb, s3Base, awsRequestId) => {
  const consistencySource = consistencySourceFactory(
    dynamoDb,
    s3Base,
    awsRequestId
  )
  const consistencyProcessor = fromFunctions(consistencySource)
  return consistencyProcessor
}

module.exports = {
  consistencyFactory,
  toFunctions,
  ramDynamoDbFactory,
  ramS3Factory,
  consistencySourceFactory,
  s3Keys,
  dbFactory,
}
