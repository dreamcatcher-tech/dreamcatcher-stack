import { addressModel, channelModel } from '..'
import { Network } from '../src/models/Network'

describe('Network', () => {
  test('large network', () => {
    let network = new Network()
    let channel = channelModel.create()
    let start = Date.now()
    const count = 200
    const next = {}
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = addressModel.create('GENESIS')
      channel = channelModel.create(address)
      // network = network.merge({ [alias]: channel })
      next[alias] = channel
    }
    network = network.merge(next)
    debug(`time to %o: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.merge({ addOne: channel })
    debug(`add one time %o ms`, Date.now() - start)
    start = Date.now()
    const hash = network.getHash()
    debug(`hash time: %o ms`, Date.now() - start)
    network = network.merge({ addTwo: channel })
    start = Date.now()
    const hash2 = network.getHash()
    debug(`hash2 time: %o ms`, Date.now() - start)
    start = Date.now()
    const string = network.serialize()
    debug(`serialize: %o ms size: %o`, Date.now() - start, string.length)
    start = Date.now()
    flatstr(string)
    debug(Buffer)
    const buf = Buffer.from(string)
    debug(`conversion time: %o ms`, Date.now() - start)
    start = Date.now()
    const compressed = snappy.compressSync(buf)
    debug(`snappy %o ms size: %o`, Date.now() - start, compressed.length)
    start = Date.now()
    const compressed2 = snappyjs.compress(buf)
    debug(`snappyjs %o ms size: %o`, Date.now() - start, compressed2.length)
    start = Date.now()
    const compressed3 = stringify(network)
    debug(`zipson %o ms size: %o`, Date.now() - start, compressed3.length)
  })
})
