import { createRepo } from 'ipfs-repo'
import { Interpulse } from '../../w300-interpulse/src/Interpulse'
import { createBackend } from './fixtures/createBackend'
import { loadCodec } from './fixtures/loadCodec'
import Debug from 'debug'
const debug = Debug('interblock:tests:ipfs')
Debug.log = console.log.bind(console)

describe('ipfs', () => {
  test('repo', async () => {
    const repo = createRepo('test', loadCodec, createBackend())
    await repo.init({})
    await repo.open()
    debug(await repo.stat())
  })
  test('reload', async () => {
    const repo = createRepo('ram', loadCodec, createBackend())
    debug(`starting engine`)
    const engine = await Interpulse.createCI({ repo })
    debug(`engine started`)

    await engine.add('child1')
    await engine.cd('child1')
    await engine.shutdown()
    debug(await repo.stat())
    const reboot = await Interpulse.createCI({ repo })
    const latest = await reboot.latest('/')
    expect(latest.getState().toJS()).toEqual({ wd: '/child1' })
  })
})
