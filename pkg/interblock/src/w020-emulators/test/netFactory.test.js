import { assert } from 'chai/index.mjs'
import { effectorFactory } from '..'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:effectorFactory')

describe('netFactory', () => {
  Debug.enable('*met* *tests* *effector *:net *:socket *transport')

  test.skip('ping single', async () => {
    jest.setTimeout(20000)
    debug(`start`)
    const client = await effectorFactory()
    client.metro.enableLogging()
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
