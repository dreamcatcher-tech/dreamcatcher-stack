const AWSXRay = require('aws-xray-sdk-core')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
AWS.config.update({ region: 'eu-central-1' })
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' })
const assert = require('assert')
const debug = require('debug')('interblock:troll')
const sqsBase = `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT_ID}/`
const streamProcessor = require('../../w203-lambda-test/aws-stream-processor/streamProcessor.js')
const { websocketTest } = require('./postDeployCheck/websocketTest')

const ReceiveRequestAttemptId = 'troller'
require('debug').enable(
  '*troll *streamProcessor *hyper *consistency *queue* *s3* *crypto*'
)

const troll = async () => {
  debug('boot troll')

  let active = true
  process.once('exit', function () {
    debug(`shutting down`)
    active = false
  })
  const awaits = ['sqsRx', 'sqsTransmit', 'sqsPool', 'sqsIncrease'].map(
    async (queueName) => {
      const QueueUrl = sqsBase + queueName
      process.env[queueName + 'Url'] = QueueUrl // mimick AWS environment
      const params = {
        QueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 1,
        AttributeNames: ['All'],
        ReceiveRequestAttemptId,
      }
      while (active) {
        debug(`${queueName} begin poll...`)
        const start = Date.now()
        const result = await sqs.receiveMessage(params).promise()
        const elapsed = Date.now() - start
        const recordsRaw = result.Messages || []
        recordsRaw.length && debug(`${queueName} poll took: ${elapsed} ms`)
        const toLowerCase = (record) => _toLowerCase(queueName, record)
        const Records = recordsRaw.map(toLowerCase)
        await streamProcessor.handler({ Records }, { awsRequestId: 'troll' })
        debug(`${queueName} returned ${recordsRaw.length} messages`)
        // active = false
      }
    }
  )
  await Promise.all(awaits)
}

const _toLowerCase = (queueName, r) => ({
  messageId: r.MessageId,
  receiptHandle: r.ReceiptHandle,
  body: r.Body,
  attributes: r.Attributes,
  messageAttributes: {},
  md5OfBody: r.MD5OfBody,
  eventSource: 'aws:sqs',
  eventSourceARN: _getEventSourceArn(queueName),
  awsRegion: process.env.AWS_REGION,
})

const _getEventSourceArn = (queueName) =>
  `arn:aws:sqs:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:${queueName}`

const websocket = async () => {
  const result = await websocketTest(process.env.WEBSOCKET)
  debug(`websocket result: `, result)
}

const segment = new AWSXRay.Segment('troll')
const xrayNamespace = AWSXRay.getNamespace()
// TODO turn off
xrayNamespace.run(async () => {
  AWSXRay.setSegment(segment)
  await troll()
})

websocket()
