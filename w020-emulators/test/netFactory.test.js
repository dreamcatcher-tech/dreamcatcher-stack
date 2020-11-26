const assert = require('assert')
const { effectorFactory } = require('..')
const debug = require('debug')('interblock:tests:effectorFactory')

describe('netFactory', () => {
  require('debug').enable('*met* *tests* *effector *:net *:socket *transport')

  test('ping single', async () => {
    jest.setTimeout(20000)
    debug(`start`)
    const client = await effectorFactory()
    client.enableLogging()
    const url = 'wss://echo.websocket.org'
    const urlSafe = 'wss:||echo.websocket.org'
    await client.startNetworking()
    await client.net.add(url)
    const socket = client.net[urlSafe]
    assert(socket)
    const connectResult = await socket.connect()

    const testData = 'testData'
    const pingReply = await socket.ping(testData)
    assert.strictEqual(pingReply.data, testData)

    const disconnectResult = await socket.disconnect()
    await assert.rejects(socket.ping, (error) =>
      error.message.startsWith('No socket found')
    )

    await client.settle()
    debug(`pingReply latencyMs`, pingReply.latencyMs)
    debug(`connectResult latencyMs`, connectResult.latencyMs)
    debug(`disconnectResult latencyMs`, disconnectResult.latencyMs)
    debug(`stop`)
  })
})
