const assert = require('assert')
const { effectorFactory, awsFactory } = require('..')
const debug = require('debug')('interblock:tests:awsFactory')
require('../../w012-crypto').testMode()

describe('awsFactory', () => {
  test.todo('parallel connects') // two shells connecting to the same terminal
  // one after the other should result in correct connections for both
  test('connect', async () => {
    require('debug').enable('*metro* *awsFactory')
    debug(`start`)
    const client = await effectorFactory('eff')
    const aws = await awsFactory('aws')

    // cross over internet
    client.sqsTx.setProcessor(aws.sqsRx.push)
    aws.sqsTx.setProcessor(client.sqsRx.push)

    /**
     * Somehwere in here, these features need to be leveraged:
     * 1. DONE connecting with a completely unknown chain
     * 2. opening up another chain
     * 3. connecting to a chain that has been opened for you
     * 4. closing an existing connection
     * 5. forcefully closing a connection
     * 6. reopening a previously closed connection
     */

    const { hyperAddress } = aws
    debug(`hyperAddress: ${hyperAddress.getChainId()}`)
    const testSocketInfo = { url: 'testingSocketInfo' }
    await client.addTransport(hyperAddress, testSocketInfo)

    const creds = {
      method: 'password',
      user: 'test user',
      pass: 'test pass',
      terminal: hyperAddress.getChainId(),
    }
    // TODO test rejected ping before login passes
    const loginResult = await client.login(creds)
    debug(`loginResult: `, loginResult)
    // causes terminal to pass more commands of ours on
    await client.engine.settle(aws.engine)

    require('debug').enable('*metro* *shell *awsFactory')
    debug(`begin ping`)
    const start = Date.now()
    const pong = await client.ping('terminal')
    debug(`terminal ping result: `, pong)
    assert.equal(pong.type, 'PONG')
    debug(`ping RTT: ${Date.now() - start} ms`)

    await aws.engine.settle()
    await client.engine.settle()
    debug(`stop`)
  })
})
