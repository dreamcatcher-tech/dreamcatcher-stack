import assert from 'assert-fast'
import * as IPFS from 'ipfs-core'
import { createRepo } from 'ipfs-repo'
import { Interpulse } from '../../w300-interpulse/src/Interpulse'
import { createBackend } from './fixtures/createBackend'
import { loadCodec } from './fixtures/loadCodec'

import { peerIdFromKeys } from '@libp2p/peer-id'
import { keys } from '@libp2p/crypto'

import Debug from 'debug'
import { Keypair } from '../../w008-ipld'
const debug = Debug('interblock:tests:ipfs')

describe('ipfs', () => {
  test.only('repo', async () => {
    const repo = createRepo('test', loadCodec, createBackend())
    await repo.init({})
    await repo.open()
    console.log(await repo.stat())
  })
  test('reload', async () => {
    Debug.enable('*ipfs* *Endurance *engine')
    const repo = createRepo('ram', loadCodec, createBackend())
    debug(`starting engine`)
    const engine = await Interpulse.createCI({ repo })
    debug(`engine started`)
    return

    const options = {
      repo,
      init: { emptyRepo: true },
      start: false,
      offline: true,
    }
    const ipfs = await IPFS.create(options)
    await ipfs.start()
    await ipfs.stop()
    const ipfs2 = await IPFS.create(options)
    const id2 = await ipfs.id()
    const id = await ipfs2.id()
    // const id = await ipfs.id()

    // const engine = await Interpulse.create({ repo })
    // await engine.ipfsStart()
    // await engine.add('child1')
    // await engine.cd('child1')
    // await engine.shutdown()
    // debug(await repo.stat())
    // const reboot = await Interpulse.create({ repo })
    // const latest = await engine.latest('/')
    // console.log(latest.getState().toJS())
    // assert(engine.latest() === reboot.latest('/'))
  })
})
