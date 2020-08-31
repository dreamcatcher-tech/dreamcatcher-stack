require('dotenv').config()
const uuid = require('uuid/v4')
const AWSXRay = require('aws-xray-sdk-core')
AWSXRay.capturePromise() // not sure this does anything...
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
const awsRegion = { region: 'eu-central-1' }
AWSXRay.appendAWSWhitelist({
  services: {
    s3: {
      operations: {
        getObject: {
          request_parameters: ['Bucket', 'Key'],
        },
        putObject: {
          request_parameters: ['Bucket', 'Key'],
        },
      },
    },
  },
})
const assert = require('assert')
const {
  cryptoCacher,
  addressModel,
  txModel,
  interblockModel,
} = require('../../w015-models')
const {
  standardEngineFactory,
  consistencyFactory,
  cryptoFactory,
} = require('../../w017-standard-engine')
const debug = require('debug')('interblock:aws:streamProcessor')

const queueToModelMap = {
  sqsRx: txModel,
  sqsTransmit: interblockModel,
  sqsPool: interblockModel,
  sqsIncrease: addressModel,
}
const MODES = {
  SELF: 'SELF',
  THREAD: 'THREAD',
  SQS: 'SQS',
  LAMBDA: 'LAMBDA',
  SOCKET: 'SOCKET',
}

const handler = async (event, context) => {
  // called by sqs trigger, and lambda direct invoke, and rxSocket
  const invokeMode = detectInvokeMode(event)
  const baseSegment = AWSXRay.getSegment()
  const invokeSegment = baseSegment.addNewSubsegment(`Invoke: ${invokeMode}`)
  AWSXRay.setSegment(invokeSegment) // capture all subsequent requests as children of this segment
  invokeSegment.addAnnotation(`InvokeMode`, invokeMode)

  const consoleLog = []
  require('debug').log = (msg) => {
    const timestamp = new Date().toISOString()
    const lines = msg.split(`\n`)
    lines.map((line) => consoleLog.push(timestamp + ' ' + line))
  }

  let statusCode = 200
  switch (invokeMode) {
    case MODES.SQS:
      statusCode = await invokedBySqs(event, context)
      break
    case MODES.LAMBDA:
      statusCode = await invokedByLambda(event, context)
      break
    case MODES.SOCKET:
      statusCode = await invokedBySocket(event, context)
      break
    default:
      throw new Error(`Unknown invokeMode: ${invokeMode}`)
  }
  // TODO signal success to original invoker, then scavenge cpu cycles

  invokeSegment.addMetadata('console.log', consoleLog, 'debug')
  invokeSegment.close()
  AWSXRay.setSegment(baseSegment) // else end up with endless children
  return { statusCode }
}

const getActionType = (routeKey, body) => {
  console.log(`getActionType`, routeKey, body)
  const map = { $connect: 'CONNECT', $disconnect: 'DISCONNECT' }
  if (!map[routeKey]) {
    assert.equal(routeKey, '$default')
    if (body.startsWith('PING_LAMBDA')) {
      return 'PING_LAMBDA'
    }
    // use the action key of body instead to define custom actions
  }
  return map[routeKey]
}

const invokedBySocket = async (event, context) => {
  const { requestContext, body } = event
  const {
    routeKey,
    eventType,
    connectionId: id,
    domainName: domain,
    stage,
  } = requestContext

  const actionType = getActionType(routeKey, body)
  const type = `Socket: ${actionType}`
  const baseSegment = AWSXRay.getSegment()
  const socketSegment = baseSegment.addNewSubsegment(type)
  AWSXRay.setSegment(socketSegment)
  socketSegment.addAnnotation('SocketType', actionType)

  debug('event %O', event)
  debug('context %O', context)

  const rxInterblock = async (socket, interblock) => {
    debug(`rxInterblock`)
    const locksIdentifier = uuid()
    const tx = await convertToModel({ socket, interblock }, txModel)
    const queueName = `sqsRx`
    const awsProcessor = generateEngine(queueName, locksIdentifier)
    await awsProcessor(tx)
  }

  const socket = { id, type: 'awsApiGw', info: { id, domain, stage } }

  let statusCode = 200
  switch (actionType) {
    case 'CONNECT':
      // check flood protection, conduct auth if new
      break
    case 'DISCONNECT':
      // clean up socket entry in socket table
      break
    case 'PING_LAMBDA':
      await sendToClient(socket, body.replace(`PING`, `PONG`))
      break
    case 'INTERBLOCK':
      await rxInterblock(socket, interblock)
      break
    default:
      debug(`unknown actionType`)
      statusCode = 400
  }
  socketSegment.close() // think same as flush() - sends data to the daemon
  AWSXRay.setSegment(baseSegment) // else end up with endless children
  return statusCode
}

const sendToClient = async (socket, Data) => {
  const { id, domain, stage } = socket.info
  debug(`transmitting to socket.id: %o`, id)
  const client = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `https://${domain}/${stage}`,
  })
  await client
    .postToConnection({
      ConnectionId: id,
      Data,
    })
    .promise()
  debug(`transmit complete`)
}

const generateEngine = (queueName, locksIdentifier) => {
  assert(queueToModelMap[queueName], `unknown queueName: ${queueName}`)
  // try keep segments separate by invocation

  const engine = standardEngineFactory()

  replaceQueueProcessors(engine)
  replaceConsistencyProcessor(engine, locksIdentifier)
  replaceCryptoProcessor(engine)

  return async (instance) => {
    // act like we are the processor on the end of a queue
    // wire up outbound queues to connect to infra - sqs, lambda
    // push into the queue directly, and await completion

    const subseg = AWSXRay.getSegment().addNewSubsegment(queueName)
    subseg.addAnnotation('QueueName', queueName)
    const model = queueToModelMap[queueName]
    assert(model, `invalid model for ${queueName}`)
    assert(model.isModel(instance), `instance not model: ${instance}`)
    debug(`processing: ${queueName}`)
    const processor = engine[queueName].getProcessor()
    await processor(instance)
    // ? wait for engine to settle ?
    subseg.close()
  }
}
const invokedByLambda = async (event, context) => {
  debug(`invokeLambda`, event)
  assert(event.queueName)

  const awsEngine = generateEngine(queueName, context.awsRequestId)
  const isValidPayload = await awsEngine(body)
  !isValidPayload && debug(`invalid payload`)
}

const invokedBySqs = async (event, context) => {
  // break the batch up, and for each one, run the engine
  // detect the specific mode of the message, as they come in jumbled now

  // sqs batch mode
  debug(`invoked in sqs batch mode`)
  assert(event && event.Records && Array.isArray(event.Records))

  const batchSize = event.Records.length
  debug(`Proccessing ${batchSize} events`)
  const batchSegment = AWSXRay.getSegment().addNewSubsegment(
    `Batch: ${batchSize}`
  )
  batchSegment.addMetadata('event', event)
  batchSegment.addMetadata('context', context)
  // TODO pull out xray traceId from each message

  const awaits = event.Records.map(async (record, index) => {
    debug(`processing record index: ${index}`)
    const { eventSource, eventSourceARN, receiptHandle, body } = record
    assert(eventSource === 'aws:sqs')
    const queueName = eventSourceARN.split(':').pop()
    debug(`queueName: ${queueName}`)
    assert(queueToModelMap[queueName], `unknown queueName: ${queueName}`)

    const awsEngine = generateEngine(queueName, context.awsRequestId)
    const isValidPayload = await awsEngine(body)

    !isValidPayload && debug(`invalid payload`)
    await deleteMessage(receiptHandle, eventSourceARN)
  })
  debug(`all messages in flight`)
  await Promise.all(awaits)
  debug(`processing complete`)
  batchSegment.close()
}

const detectInvokeMode = (event) => {
  if (event.Records) {
    assert(Array.isArray(event.Records))
    return MODES.SQS
  }
  return MODES.SOCKET
}

const switchSqsTarget = () => {
  // looks at current system load, and decides where to route the request
  // assesses backpressure in queues, and current system load
  return MODES.SELF
}

const sqsQueueProcessor = (queueName, engine) => async (action) => {
  debug(`queueProcessor: ${queueName}`)
  assert(queueToModelMap[queueName])
  const target = switchSqsTarget()
  switch (target) {
    case MODES.SELF:
      await pushSelf(queueName, action, engine)
      break
    case MODES.THREAD:
      await pushThread(queueName, action)
      break
    case MODES.LAMBDA:
      await pushLambda(queueName, action)
      break
    case MODES.SQS:
      await pushSqs(queueName, action)
      break
    default:
      throw new Error(`Unknown target: ${target}`)
  }
}

const pushSelf = async (queueName, action, engine) => {
  // set up a new instance of engine, to make new xray segments
  await engine[queueName].pushDirect(action)
}

const pushThread = async (queueName, action) => {
  // call and engine running on another thread on the same machine
  throw new Error(`Not implemented`)
}

const pushSqs = async (queueName, action) => {
  // TODO add xray segment ID if not automatic ?

  const MessageBody = action.serialize()
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
  await sqs.sendMessage({ QueueUrl, MessageBody }).promise()
}

const pushLambda = async () => {
  debug(`invoking lambda`)
  const Payload = JSON.stringify({ queueName, action })
  const params = {
    FunctionName: 'streamProcessor',
    InvocationType: 'Event',
    Payload,
  }
  const lambda = new AWS.Lambda()
  const result = await lambda.invoke(params).promise()
  debug(`result: `, result)
  // TODO failover to sqs if lambda is throttling
}

const deleteMessage = async (ReceiptHandle, eventSourceARN) => {
  const queueName = eventSourceARN.split(':').pop()
  const QueueUrl = getQueueUrl(eventSourceARN)
  const AWS = AWSXRay.captureAWS(require('aws-sdk'))
  AWS.config.update(awsRegion)
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
  debug(`deleting ${ReceiptHandle.substring(0, 16)} from ${queueName}`)
  await sqs.deleteMessage({ QueueUrl, ReceiptHandle }).promise()
}

const replaceQueueProcessors = (engine) => {
  const { sqsTx, sqsRx, sqsTransmit, sqsPool, sqsIncrease } = engine
  // const { sqsRxUrl, sqsTransmitUrl, sqsPoolUrl, sqsIncreaseUrl } = process.env
  // assert(sqsRxUrl && sqsTransmitUrl && sqsPoolUrl && sqsIncreaseUrl)

  sqsTx.setSqsProcessor(apiGatewayProcessor('sqsTx', engine))
  sqsRx.setSqsProcessor(sqsQueueProcessor('sqsRx', engine))
  sqsTransmit.setSqsProcessor(sqsQueueProcessor('sqsTransmit', engine))
  sqsPool.setSqsProcessor(sqsQueueProcessor('sqsPool', engine))
  sqsIncrease.setSqsProcessor(sqsQueueProcessor('sqsIncrease', engine))
}

const replaceConsistencyProcessor = ({ ioConsistency }, lockName) => {
  const AWS = AWSXRay.captureAWS(require('aws-sdk'))
  AWS.config.update(awsRegion)
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  const s3 = new AWS.S3()
  ioConsistency.setProcessor(consistencyFactory(dynamoDb, s3, lockName))
}

const replaceCryptoProcessor = ({ ioCrypto }) => {
  const AWS = AWSXRay.captureAWS(require('aws-sdk'))
  AWS.config.update(awsRegion)
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  const cryptoProcessor = cryptoFactory(dynamoDb, 'aws1')
  ioCrypto.setProcessor(cryptoProcessor)
}

const apiGatewayProcessor = (queueName, { ioConsistency }) => async (tx) => {
  assert.equal(queueName, 'sqsTx')
  assert(txModel.isModel(tx))
  const { socket, interblock } = tx
  const data = interblock.serialize()
  try {
    await sendToClient(socket, data)
  } catch (e) {
    debug(`transmit error: %O %O `, e.message, e)
    if (e.message === '401') {
      // extend txModel to have forAddress so can delete from db directly
      await ioConsistency.delSocket()
    }
  }
}

const convertToModel = async (obj, model) => {
  try {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj)
    }
    assert.equal(typeof obj, 'object')
    await cryptoCacher.cacheVerifyHash(obj)
    // TODO use obj once find why fail
    return model.clone(obj)
  } catch (e) {
    debug(`convertToModel error: ${e.message}`)
  }
}

const getQueueUrl = (arn) => {
  const accountId = arn.split(':')[4]
  const queueName = arn.split(':')[5]
  const AWS = require('aws-sdk')
  AWS.config.update(awsRegion)
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
  const queueUrl = sqs.endpoint.href + accountId + '/' + queueName
  return queueUrl
}

const recordExample = {
  Records: [
    {
      messageId: '9cb-e919',
      receiptHandle: 'AQEBJRZxkYAwBMPpN4...rVCoU70HTdEVZXuPUVBw==',
      body: 'value0.6888803697786434',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1530189332727',
        SenderId: 'AROAI62IBJVPVG:sqs-flooder',
        ApproximateFirstReceiveTimestamp: '1530189332728',
      },
      messageAttributes: {},
      md5OfBody: '7ce3453347fd9b304a1f9d',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:XXXXXXXX:test-sqs-trigger-queue',
      awsRegion: 'us-east-1',
    },
  ],
}

module.exports = { handler }
