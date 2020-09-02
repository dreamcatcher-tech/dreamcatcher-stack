const assert = require('assert')
const debug = require('debug')('interblock:test:awsWebsocket')
const { tcpTransportFactory } = require('../src/tcpTransportFactory')
describe('awsWebsocket', () => {
  jest.setTimeout(10000)

  require('debug').enable(`interblock:test:awsWebsocket *:transport`)
  test('connect', async () => {
    const { url } = require('../.serverless/Template.apiGateway.json')
    debug(`url: `, url)
    const socket = tcpTransportFactory(url)
    await assert.doesNotReject(socket.connect)
    debug(`socket connected`)
    await assert.doesNotReject(async () =>
      debug(`pong received after %o ms`, await socket.ping(`test data`))
    )
    await assert.doesNotReject(async () =>
      debug(
        `pongLambda received after %o ms`,
        await socket.pingLambda(`test data`)
      )
    )

    await assert.doesNotReject(socket.close)
    debug(`socket disconnected`)
  })
  test('bundle not built with production mode', async () => {
    const streamProcessorRaw = require('../../w202-lambda-stream-processor/dist/streamProcessor')
    assert(typeof streamProcessorRaw.handler === 'function')
    await assert.rejects(streamProcessorRaw.handler, `is production mode off ?`)
  })
})
