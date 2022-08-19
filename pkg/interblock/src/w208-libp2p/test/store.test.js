import { deleteAsync } from 'del'
import { createRepo } from 'ipfs-core-config/repo'
import { Interpulse } from '../../w300-interpulse/src/Interpulse'
import { createBackend } from '../src/createBackend'
import { loadCodec } from '../src/loadCodec'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { CID } from 'multiformats/cid'
import { KadDHT } from '@libp2p/kad-dht'
import all from 'it-all'
import delay from 'delay'
import Debug from 'debug'
import { Pulse } from '../../w008-ipld'
const debug = Debug('interpulse:tests:ramrepo')
Debug.enable('*tests*')
describe('store', () => {
  test('basic', async () => {
    // get a basic repo going
    // try store blocks and dht values in it
    // ensure our dht storage takes precedence

    const repo = createRepo('test', loadCodec, createBackend())
    const options = {
      addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
      transports: [new TCP()],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      dht: new KadDHT(),
      repo,
    }
    const node = await createLibp2p(options)
    await node.loadKeychain()
    debug(repo.keys)
    await node.start()
    debug(repo.keys)
  })
  test('disk', async () => {
    const path = `tmp/repo-${Math.random()}`
    try {
      const repo = createRepo(debug, loadCodec, { path })
      const options = {
        addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
        transports: [new TCP()],
        streamMuxers: [new Mplex()],
        connectionEncryption: [new Noise()],
        dht: new KadDHT(),
        repo,
      }
      const node = await createLibp2p(options)
      await node.loadKeychain()
      debug(repo.keys)
      await node.start()
      debug(repo.keys)
    } catch (e) {
      debug(e)
    } finally {
      debug(`deleting ${path}`)
      await deleteAsync(path)
      debug(`deleted ${path}`)
    }
  })
})
