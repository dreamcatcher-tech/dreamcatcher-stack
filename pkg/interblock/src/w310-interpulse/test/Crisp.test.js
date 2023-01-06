import { Interpulse, Crisp, Syncer } from '..'
import { crm } from '../../w301-user-apps'
import { Pulse } from '../../w008-ipld/src'
import last from 'it-last'
import Debug from 'debug'
const debug = Debug('tests')

describe('Crisp', function () {
  it.skip('should create a Crisp', async function () {
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
  it.skip('reconciles diffs', async () => {
    // repeat the inflates test prep
    // make a change to the pulse deep in a child
    // start the reconcile
    // test the diffing was done efficiently

    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('app', '/crm')
    const approot = await engine.current('app')
    Debug.enable('iplog *Crisp *Syncer tests')
    const syncer = Syncer.create(engine.pulseResolver)
    await syncer.update(approot)
    const children = []
    for await (const crisp of syncer) {
      debug('crisp', crisp)
      for (const child of crisp) {
        // gives just the children we are currently aware of
        children.push(child)
      }
      break
    }
    expect(children).toEqual(['routing', 'about', 'customers', 'schedule'])
  }, 1500)
})
