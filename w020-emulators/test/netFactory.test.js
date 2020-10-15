const assert = require('assert')
const { effectorFactory } = require('..')
const debug = require('debug')('interblock:tests:effectorFactory')

describe('netFactory', () => {
  require('debug').enable('*metro* *tests*')

  test.only('ping single', async () => {
    debug(`start`)
    const client = await effectorFactory()
    client.enableLogging()

    client.net.add()
    // add a transport to echo.websocket.org
    // perform a transport layer ping
    // close the socket
    // observe ping failure

    const reply = await client.ping()

    await client.settle()

    debug(`stop`)
  })
})
