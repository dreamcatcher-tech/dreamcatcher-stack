import { createRamRepo } from '../../w305-libp2p'
import { Interpulse, Crisp, Syncer } from '..'
import { crm } from '../../w301-user-apps'
import { Pulse } from '../../w008-ipld/src'
import last from 'it-last'
import Debug from 'debug'
const debug = Debug('tests')

describe('Crisp', function () {
  it('should create a Crisp', async function () {
    const pulse = await Pulse.createCI({ state: { test: true } })
    const crisp = Crisp.createRoot(pulse)
    expect(crisp).toBeInstanceOf(Crisp)
    expect(crisp.state).toEqual({ test: true })
    expect(crisp.hasChild('not a path')).toBe(false)

    // add a child to the pulse
    // dump the engine cache
  })
  it('inflates', async () => {
    // start up the engine
    // make some children
    // dump the engine cache
    // uncrush the pulse
    // test the crisp is missing pieces
    // start the reconciler
    // test the crisp is fully loaded
  })
  it.only('reconciles diffs', async () => {
    const repo = createRamRepo('ram')
    let engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    await engine.add('app', '/crm')
    await engine.stop()
    engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    const approot = await engine.current('app')
    Debug.enable('iplog *Crisp *Syncer tests')
    const syncer = Syncer.create(engine.pulseResolver)
    // restart the engine so can do timing
    debug('starting syncer')
    await syncer.update(approot)
    debug('syncer complete')
    for await (const crisp of syncer) {
      debug('crisp', crisp)
      const children = [...crisp]
      debug(children)
      expect(children).toMatchSnapshot()
      break
    }
    await engine.stop()
  }, 1500)
})
