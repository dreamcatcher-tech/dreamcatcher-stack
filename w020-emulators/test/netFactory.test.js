const assert = require('assert')
const { effectorFactory } = require('..')
const debug = require('debug')('interblock:tests:effectorFactory')

describe('netFactory', () => {
  require('debug').enable(
    '*met* *tests* *effector *:net *:socket *transport *dmzReducer'
  )

  test('ping single', async () => {
    jest.setTimeout(20000)
    debug(`start`)
    const client = await effectorFactory()
    client.enableLogging()
    const url = 'wss://echo.websocket.org'
    const urlSafe = 'wss:||echo.websocket.org'
    await client.net.add(url)
    assert(client.net[urlSafe])
    const connectResult = await client.net[urlSafe].connect()

    // add a transport to echo.websocket.org
    // perform a transport layer ping
    // close the socket
    // observe ping failure

    const testData = 'testData'
    const pingReply = await client.net[urlSafe].ping(testData)
    assert.strictEqual(pingReply.data, testData)
    await client.settle()
    debug(`pingReply latencyMs`, pingReply.latencyMs)
    debug(`connectResult latencyMs`, connectResult.latencyMs)
    debug(`stop`)
  })
})
