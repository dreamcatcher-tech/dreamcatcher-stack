const assert = require('assert')
const { effectorFactory } = require('..')
const debug = require('debug')('interblock:tests:effectorFactory')

describe('netFactory', () => {
  require('debug').enable('*metro* *tests*')

  test('ping single', async () => {
    debug(`start`)
    const client = await effectorFactory()
    client.enableLogging()

    const url = 'wss://echo.websocket.org'
    client.net.add(url)
    assert(client.net[url])
    await client.net[url].connect()

    // add a transport to echo.websocket.org
    // perform a transport layer ping
    // close the socket
    // observe ping failure

    const testData = 'testData'
    const reply = await client[url].ping(testData)
    assert.strictEqual(reply.payload, testData)
    await client.settle()
    debug(`stop`)
  })
})
