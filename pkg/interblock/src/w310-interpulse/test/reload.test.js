import { deleteAsync } from 'del'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
import { Keypair, Pulse } from '../../w008-ipld'
import { jest } from '@jest/globals'
import { Interpulse } from '..'

const debug = Debug('tests')

Debug.enable('tests')

describe('reload', () => {
  jest.setTimeout(2000)
  test.only('interpulse ram reload', async () => {
    const repo = createRamRepo('ram')
    debug(`starting engine`)
    const engine = await Interpulse.createCI({ repo })
    debug(`engine started`)

    await engine.add('child1')
    await engine.cd('child1')
    await engine.stop()
    debug('stat', await repo.stat())
    const reboot = await Interpulse.createCI({ repo })
    const latest = await reboot.latest('/')
    await reboot.stop()
    expect(latest.getState().toJS()).toEqual({ wd: '/child1' })
  })
  test('interpulse disk reload', async () => {
    const repo = `tmp/reload-${Math.random()}`
    Debug.enable('*tests* ipfs*')
    try {
      const engine = await Interpulse.createCI({ repo })
      await new Promise((r) => setTimeout(r, 500))
      await engine.stop()
    } finally {
      debug(`deleting ${repo}`)
      await deleteAsync(repo)
      debug(`deleted ${repo}`)
    }
  })
})
