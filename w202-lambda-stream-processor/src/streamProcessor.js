const { v4: uuid } = require('uuid')
const AWSXRay = require('aws-xray-sdk-core')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
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
  setLogger,
  consistencyQueueToFunctions,
} = require('../../w017-standard-engine')
const { awsLogger } = require('./awsLogger')
const {
  startXrayLogging,
  startXrayParentSegment,
  startXraySegment,
} = require('./xrayTracer')
// setLogger(awsLogger)
const debug = require('debug')('interblock:aws:streamProcessor')

const queueToModelMap = {
  sqsTx: txModel,
  sqsRx: txModel,
  sqsTransmit: interblockModel,
  sqsPool: interblockModel,
  sqsIncrease: addressModel,
}
const MODES = {
  THREAD: 'THREAD',
  SQS: 'SQS',
  LAMBDA: 'LAMBDA',
  SOCKET: 'SOCKET',
}
const checkAssert = () => {
  try {
    assert.fail()
  } catch (e) {
    return
  }
  throw new Error(`Assert is essential to safe operation`)
}
const handler = async (event, context) => {
  checkAssert()
  assert.equal(typeof event, 'object')
  assert.equal(typeof context, 'object')

  const stopXrayLogging = startXrayLogging()
  const invokeMode = detectInvokeMode(event)
  await startXrayParentSegment(`InvokeMode`, invokeMode, async () => {
    debug(`initial remaining time: %o ms`, context.getRemainingTimeInMillis())
    const { body, ...eventWithoutBody } = event
    debug(`handler event: %O context: %O`, eventWithoutBody, context)
    switch (invokeMode) {
      case MODES.THREAD:
        break
      case MODES.SQS:
        await invokedBySqs(event, context)
        break
      case MODES.LAMBDA:
        await invokedByLambda(event, context)
        break
      case MODES.SOCKET:
        await invokedBySocket(event, context)
        break
      default:
        throw new Error(`Unknown invokeMode: ${invokeMode}`)
    }
    // TODO signal success to original invoker, then scavenge cpu cycles
    debug(`remaining: %o ms`, context.getRemainingTimeInMillis())
  })
  stopXrayLogging()
  return { statusCode: 200 }
}

const invokedBySocket = async (event, context) => {
  const { requestContext, body } = event
  const { routeKey, stage } = requestContext
  const { connectionId: id, domainName: domain } = requestContext
  const actionType = detectActionType(routeKey, body)
  await startXrayParentSegment(`SocketType`, actionType, async () => {
    const socket = { id, type: 'awsApiGw', info: { id, domain, stage } }
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
        await rxInterblock(socket, body)
        break
      default:
        throw new Error(`Unknown action type: ${actionType}`)
    }
  })
}
const rxInterblock = async (socket, interblockJson) => {
  debug(`rxInterblock`)
  const interblock = JSON.parse(interblockJson)
  const rx = await convertToModel({ socket, interblock }, txModel)

  const locksIdentifier = uuid()
  const lambdaEngine = generateLambdaEngine(locksIdentifier)
  await pushSelf(`sqsRx`, rx, lambdaEngine)
  // TODO WARNING might stall the engine, if pushToSelf is loaded
  await lambdaEngine.settle()
}

const generateLambdaEngine = (locksIdentifier) => {
  // create segment dedicated to engine here
  const engine = standardEngineFactory()

  replaceQueueProcessors(engine)
  replaceConsistencyProcessor(engine, locksIdentifier)
  replaceCryptoProcessor(engine)

  const settle = async () => {
    const queues = Object.values(engine)
    while (queues.some((q) => q.length() || q.awaitingLength())) {
      const awaits = queues.map((q) => q.settle())
      await Promise.all(awaits)
      await new Promise(setImmediate)
    }
  }

  return { ...engine, settle }
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
const switchSqsTarget = (queueName) => {
  // looks at current system load, and decides where to route the request
  // assesses backpressure in queues, and current system load
  if (queueName === `sqsTx`) {
    return MODES.SELF
  }
  return MODES.SELF
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
  sqsTx.setProcessor(apiGatewayProcessor(engine))

  sqsTx.setSqsProcessor(sqsQueueProcessor('sqsTx', engine))
  sqsRx.setSqsProcessor(sqsQueueProcessor('sqsRx', engine))
  sqsTransmit.setSqsProcessor(sqsQueueProcessor('sqsTransmit', engine))
  sqsPool.setSqsProcessor(sqsQueueProcessor('sqsPool', engine))
  sqsIncrease.setSqsProcessor(sqsQueueProcessor('sqsIncrease', engine))
}
const sqsQueueProcessor = (queueName, engine) => async (action) => {
  assert(queueToModelMap[queueName], `bad queueName: ${queueName}`)
  const target = switchSqsTarget(queueName)
  switch (target) {
    case MODES.SELF:
      pushSelf(queueName, action, engine)
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
const pushSelf = (queueName, action, engine) => {
  startXraySegment(`Queue`, queueName, async () => {
    debug(`pushSelf: %o`, queueName)
    // ? place a trace in each queue, so can see how it moves around the machine ?
    await engine[queueName].pushDirect(action)
  })
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
const replaceConsistencyProcessor = ({ ioConsistency }, lockName) => {
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  const s3 = new AWS.S3()
  ioConsistency.setProcessor(consistencyFactory(dynamoDb, s3, lockName))
}
const replaceCryptoProcessor = ({ ioCrypto }) => {
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  const cryptoProcessor = cryptoFactory(dynamoDb, 'aws1')
  ioCrypto.setProcessor(cryptoProcessor)
}
const apiGatewayProcessor = ({ ioConsistency }) => async (tx) => {
  assert(txModel.isModel(tx))
  const { socket, interblock } = tx
  const data = interblock.serialize()
  try {
    await sendToClient(socket, data)
  } catch (e) {
    if (e.code === 'GoneException') {
      debug(`deleting gone socket`)
      const consistency = consistencyQueueToFunctions(ioConsistency)
      await consistency.delSocket(socket)
    } else {
      debug(`transmit error: %O %O `, e.message, e)
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
const detectActionType = (routeKey, body) => {
  const map = { $connect: 'CONNECT', $disconnect: 'DISCONNECT' }
  if (!map[routeKey]) {
    assert.equal(routeKey, '$default')
    if (body.startsWith('PING_LAMBDA')) {
      return 'PING_LAMBDA'
    }
    return 'INTERBLOCK'
  }
  return map[routeKey]
}

let sendToClient = async (socket, Data) => {
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

const _patchSendToClient = (newSendToClient) => {
  debug(`_patchSendToClient`)
  sendToClient = newSendToClient
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

module.exports = { handler, _patchSendToClient }
