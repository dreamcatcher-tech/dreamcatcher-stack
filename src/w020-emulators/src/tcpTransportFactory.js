/**
 * Model of a websocket transport.
 *
 * Uses:
 *    - benchmarking the network performance to gateway, and to inside the lambda function
 *
 *
 * Issues:
 *    - multiplexing multiple outstanding request replies, like pings and pongs
 *
 */
import { assert } from 'chai/index.mjs'
import { blockModel, interblockModel } from '../../w015-models'
import WebSocket from 'ws'
import Debug from 'debug'
const debug = Debug('interblock:transport')

const tcpTransportFactory = (url) => {
  // const dummyBlock = await blockModel.create()
  // const igniter = interblockModel.create(dummyBlock)

  let ws
  const connect = async () => {
    assert(!ws) // TODO graceful shutdown
    ws = new WebSocket(url)
    ws.on('message', function incoming(data) {
      debug(`message: %O`, data)
    })
    ws.on('close', (e) => debug('close', e))
    ws.on('error', (e) => debug('error %O', e))
    ws.on('ping', (e) => debug('ping', e.toString()))
    ws.on('pong', (e) => debug('pong', e.toString()))
    ws.on('upgrade', (e) => debug('upgrade'))

    const start = Date.now()
    return new Promise((resolve, reject) => {
      const unexpectedResponse = async (event) => {
        debug(`unexpectedResponse`)
        // await Promise.resolve()
        ws.terminate()
        reject(`unexpectedResponse`)
      }
      ws.on('open', function open() {
        debug(`socket open to ${url}`)
        ws.removeListener('unexpected-response', unexpectedResponse)
        resolve({ latencyMs: Date.now() - start })
      })
      ws.on('unexpected-response', unexpectedResponse)
    })
  }

  /**
   * Send a websocket layer ping with some optional data
   * and resolve the returned promise with the number of
   * milliseconds that ellapsed.  Used to talk directly to
   * an AWS ApiGateway without any lambda invocation.
   * @param {string} data optional data to send which will be echoed back
   * @return {Promise<number>} the round trip time in milliseconds
   */
  const ping = async (data = '') => {
    debug(`ping: %O`, data)
    return new Promise((resolve) => {
      const start = Date.now()
      ws.ping(data)
      ws.on('pong', (response) => {
        assert.strictEqual(response.toString(), data)
        const latencyMs = Date.now() - start
        resolve({ data, latencyMs })
      })
    })
  }

  /**
   * Send a ping to the lambda function with some optional data
   * @param {string} data optional data to send which will be echoed back
   * @return {Promise<number>} the round trip time in milliseconds
   */
  const pingLambda = async (data = '') => {
    debug(`pingLambda: %O`, data)
    return new Promise((resolve) => {
      const start = Date.now()
      ws.send(`PING_LAMBDA ${data}`)
      ws.on('message', (response) => {
        assert.strictEqual(response.toString(), `PONG_LAMBDA ${data}`)
        resolve(Date.now() - start)
      })
    })
  }

  /**
   * Returns the version of the foreign lambda function.
   */
  const version = async () => {
    debug(`version`)
    return new Promise((resolve) => {
      ws.send(`VERSION`)
      ws.on('message', (response) => {
        debug(`version`)
      })
    })
  }

  const disconnect = async () => {
    const start = Date.now()
    ws.close()
    return new Promise((resolve, reject) => {
      ws.on('close', () => resolve({ latencyMs: Date.now() - start }))
    })
  }

  const interblock = async (interblock) => {
    const OPEN = 1
    assert.strictEqual(ws.readyState, OPEN, `websocket not open`)
    ws.send(interblock.serialize())
  }

  return { connect, ping, pingLambda, version, disconnect, interblock }
}

export { tcpTransportFactory }
