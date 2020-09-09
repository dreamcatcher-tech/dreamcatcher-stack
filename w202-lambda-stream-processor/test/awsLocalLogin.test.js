require('dotenv').config()
const debug = require('debug')('interblock:aws:tests')
const AWSXRay = require('aws-xray-sdk-core')
const assert = require('assert')
const { effectorFactory, awsFactory } = require('../../w020-emulators')
const {
  cryptoCacher,
  socketModel,
  txModel,
  addressModel,
  interblockModel,
} = require('../../w015-models')
const { handler, _patchSendToClient } = require('../src/streamProcessor')
require('debug').enable('*')

describe.skip('awsLocalLogin', () => {
  test('ping lambda', async () => {
    const event = {
      requestContext: {
        routeKey: '$default',
        stage: 'troll',
        connectionId: 'cid',
        domainName: 'trolldomain',
      },
      body: 'PING_LAMBDA',
    }
    const context = { getRemainingTimeInMillis: () => {} }
    await assert.doesNotReject(() => runInXray(event, context))
  })
  test('processes login remotely', async () => {
    jest.setTimeout(1800000)
    require('debug').enable('*metro* *aws:tests* *aws:stream* *aws* *shell*')
    debug(`start`)
    const client = await effectorFactory('eff')
    const mockApiGateway = (tx) => {
      debug(`mockApiGateway %O`, tx)
      assert(txModel.isModel(tx))
      const event = {
        requestContext: {
          routeKey: '$default',
          stage: 'troll',
          connectionId: 'cid',
          domainName: 'trolldomain',
        },
        body: JSON.stringify(tx.interblock),
      }
      const context = { getRemainingTimeInMillis: () => {} }
      runInXray(event, context, client.sqsRx)
    }

    client.sqsTx.setProcessor(mockApiGateway)

    const terminalChainId =
      'd755493f14273110a9654c7f2bac5415fe3e9e93515701eba4dd36690390d919'
    const wssUrl = 'wss://fake'
    const awsSocket = socketModel.create({
      type: 'awsApiGw',
      info: { wssUrl },
    })
    await client.addTransport(terminalChainId, awsSocket.info)

    const creds = {
      method: 'password',
      user: 'test user',
      pass: 'test pass',
      terminal: terminalChainId.getChainId(),
    }
    const result = await client.login(creds)
    debug(`login result: `, result)
    debug(`begin block ping`)
    const start = Date.now()
    const pong = await client.ping('terminal')
    debug(`terminal ping result: `, pong)
    debug(`ping RTT: `, Date.now() - start)
    assert.equal(pong.type, 'PONG')
    await client.engine.settle()
    // halt the socket
  })
})

const runInXray = (event, context, clientSqsRx) =>
  new Promise((resolve, reject) => {
    AWSXRay.getNamespace().run(async () => {
      const segment = new AWSXRay.Segment('troll')
      AWSXRay.setSegment(segment)
      _patchSendToClient((socket, data) => {
        debug(`patched send to client`)
        clientSqsRx.push(data)
      })
      try {
        await handler(event, context)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
