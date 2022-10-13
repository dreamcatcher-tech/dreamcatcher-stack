import { deleteAsync } from 'del'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
import { Interpulse } from '..'

const debug = Debug('tests')

describe('reload', () => {
  test('interpulse ram reload', async () => {
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
    await reboot.cd('/child1')

    await reboot.stop()
    expect(latest.getState().toJS()).toEqual({ wd: '/child1' })
  })
  test('interpulse disk reload', async () => {
    const repo = `tmp/reload-${Math.random()}`
    try {
      debug(`starting engine`, repo)
      const engine = await Interpulse.createCI({ repo })
      debug(`engine started`)

      await engine.add('child1')
      debug('add complete')
      await engine.cd('child1')
      debug('cd complete')
      await engine.stop()
      debug('engine stopped. rebooting...')
      const reboot = await Interpulse.createCI({ repo })
      debug('reboot started')
      const latest = await reboot.latest('/')
      debug('latest fetched')
      await reboot.stop()
      debug('reboot stopped')
      expect(latest.getState().toJS()).toEqual({ wd: '/child1' })
    } finally {
      debug(`deleting ${repo}`)
      await deleteAsync(repo)
      debug(`deleted ${repo}`)
    }
  }, 4000)
  test.only('open handles', async () => {
    debug(`starting engine`)
    const engine = await Interpulse.createCI()
    await engine.add('child1') // TODO if add a child, get an open handle

    await engine.stop()
  })
})
