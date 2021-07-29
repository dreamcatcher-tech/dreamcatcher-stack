import assert from 'assert'
import { effectorFactory, awsFactory } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:awsFactory')

describe('emulateAwsFactory', () => {
  test.todo('parallel connects') // two shells connecting to the same terminal
  // one after the other should result in correct connections for both
  test.skip('connect', async () => {
    require('debug').enable('*metro* *socket*')
    debug(`start`)
    const client = await effectorFactory('eff')
    client.metro.enableLogging()
    const aws = await awsFactory('aws')
    aws.engine.disableLogging()

    // cross over internet
    client.getEngine().sqsTx.setProcessor(aws.sqsRx.push)
    aws.sqsTx.setProcessor(client.getEngine().sqsRx.push)

    /**
     * Somehwere in here, these features need to be leveraged:
     * 1. DONE connecting with a completely unknown chain
     * 2. opening up another chain
     * 3. connecting to a chain that has been opened for you
     * 4. closing an existing connection
     * 5. forcefully closing a connection
     * 6. reopening a previously closed connection
     */

    const testSocketInfo = {
      name: 'testSocket',
      type: 'internal',
      url: 'testUrl',
    }
    await client.net.add(testSocketInfo) // TODO add optional chainId ?
    assert(client.net[testSocketInfo.name])

    const { hyperAddress } = aws
    const hyperChainId = hyperAddress.getChainId()
    debug(`hyperAddress: ${hyperChainId}`)
    await client.net.testSocket.addChainId(hyperChainId)
    const credentials = {
      method: 'password',
      user: 'test user',
      pass: 'test pass',
    }
    // TODO test rejected ping before login passes
    const loginResult = await client.login(hyperChainId, credentials)
    debug(`loginResult: `, loginResult)
    await client.engine.settle(aws.engine)

    require('debug').enable('*metro* *shell *awsFactory')
    debug(`begin ping`)
    const start = Date.now()
    const pong = await client.ping('terminal')
    debug(`terminal ping result: `, pong)
    assert.strictEqual(pong.type, 'PONG')
    debug(`ping RTT: ${Date.now() - start} ms`)

    await aws.engine.settle()
    await client.engine.settle()
    debug(`stop`)
  })
})
