const assert = require('assert')
const debug = require('debug')('interblock:tests:aws')
const { effectorFactory, awsFactory } = require('../../w020-emulators')
const {
  cryptoCacher,
  socketModel,
  txModel,
  addressModel,
  interblockModel,
} = require('../../w015-models')

describe('awsLogin', () => {
  /**
   * 2020-07-04 280,000ms to do a single ping by proxy, stream on local machine
   * 2020-07-06 61,000 ms ping, local processing, fixed wifi
   * 2020-07-06 72,000 ms ping, lambda processing, fixed wifi
   * 2020-07-06 31,000 ms ping, lambda - max lambda ram
   * 2020-07-07 8,258 ms lamba - made forked provenance (ping alone RTT is 1,751 ms)
   * 2020-07-12 4,204 ms lambda, ping RTT 1,016 ms - sodium crypto
   * 2020-07-14 6,420 ms lambda, ping RTT 1,550 ms - no sqs, invoke straight from socket
   */
  test('terminal ping', async () => {
    jest.setTimeout(6000000)

    require('debug').enable('*metro* *awsFactory *tests:aws *shell*')
    debug(`start`)
    const client = await effectorFactory('eff')

    const websockets = new Map()
    const wssTx = async (tx) => {
      assert(txModel.isModel(tx))

      const { socket, interblock } = tx
      assert(socket.type === 'awsApiGw')
      const url = socket.info.wssUrl
      assert(url)

      if (!websockets.has(url)) {
        // TODO make this tightly couple with rxSocket decoding
        // TODO pack multiple interblocks in a single message
        // TODO check maximum message size / max interblock size
        const WebSocket = require('ws')
        const raw = new WebSocket(url)
        const isOpen = new Promise((resolve) => {
          raw.on('open', function open() {
            debug(`socket open to ${url}`)
            resolve()
          })
        })
        // TODO keepalive periodically
        const promise = new Promise((resolve, reject) => {
          raw.on('close', (e) => console.log('close', e))
          raw.on('error', (e) => {
            debug('error %O', e)
          })
          raw.on('ping', (e) => console.log('ping', e.toString()))
          raw.on('pong', (e) => console.log('pong', e))
          raw.on('unexpected-response', (e) =>
            debug('unexpected-response %O', e)
          )
          raw.on('upgrade', (e) => debug('upgrade'))
        })

        raw.on('message', async (data) => {
          assert(data)
          if (data.startsWith('id:')) {
            debug(`message: %O`, data)
          } else {
            debug(`interblock received`)
            // TODO use the obj once know why fails
            await cryptoCacher.cacheVerifyHash(JSON.parse(data))
            try {
              interblockModel.clone(data)
            } catch (e) {
              debug(`error: `, e, data)
            }
            const interblock = interblockModel.clone(data)

            const tx = txModel.create(awsSocket, interblock)
            await client.sqsRx.push(tx)
            debug(`interblock pushed to sqsRx`)
          }
        })
        const ws = {
          open: () => isOpen,
          send: async (interblock) =>
            new Promise((resolve) => {
              debug(
                `sending interblock heavy: %o`,
                !interblock.getTargetAddress()
              )
              const blankOptions = {}
              raw.send(interblock.serialize(), blankOptions, resolve)
            }),
        }

        websockets.set(url, ws)
      }
      const ws = websockets.get(url)
      await ws.open()
      const result = await ws.send(interblock)
    }
    client.sqsTx.setProcessor(wssTx)

    const terminalChainId =
      'd755493f14273110a9654c7f2bac5415fe3e9e93515701eba4dd36690390d919'
    const { url } = require('../.serverless/Template.apiGateway.json')
    const hyperAddress = addressModel.create(terminalChainId)
    const awsSocket = socketModel.create({
      type: 'awsApiGw',
      info: { wssUrl: url },
    })
    await client.addTransport(hyperAddress, awsSocket.info)

    const creds = {
      method: 'password',
      user: 'test user',
      pass: 'test pass',
      terminal: hyperAddress.getChainId(),
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
