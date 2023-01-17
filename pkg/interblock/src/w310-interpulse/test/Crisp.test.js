import { createRamRepo } from '../../w305-libp2p'
import { Interpulse, Crisp, Syncer } from '..'
import { crm } from '../../w301-user-apps'
import { Pulse } from '../../w008-ipld/src'
import Debug from 'debug'
const debug = Debug('tests')

describe('Crisp', function () {
  let repo
  beforeAll(async () => {
    repo = createRamRepo('ram')
    let engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    await engine.add('app', '/crm')
    await engine.stop()
  })
  it('should create a Crisp', async function () {
    const pulse = await Pulse.createCI({ state: { test: true } })
    const crisp = Crisp.createRoot(pulse)
    expect(crisp).toBeInstanceOf(Crisp)
    expect(crisp.state).toEqual({ test: true })
    expect(crisp.hasChild('not a path')).toBe(false)

    // add a child to the pulse
    // dump the engine cache
  })
  it('reconciles diffs', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    const syncer = Syncer.create(engine.pulseResolver)
    // restart the engine so can do timing
    const approot = await engine.current('app')
    debug('starting syncer')
    await syncer.update(approot)
    debug('syncer complete')

    let crisp
    for await (const first of syncer.subscribe()) {
      crisp = first
      break
    }
    debug('crisp', crisp)
    const children = [...crisp]
    children.sort((a, b) => a.localeCompare(b))
    debug(children)
    expect(children).toMatchSnapshot()
    expect(crisp.hasChild('about')).toBe(true)
    const child = crisp.getChild('about')
    expect(child).toBeInstanceOf(Crisp)
    expect(child.root).toBe(crisp)
    expect(child.state?.formData?.title).toEqual('CRM')
    await engine.stop()
  })
  it('wd is rooted in path', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    const syncer = Syncer.create(engine.pulseResolver)
    const approot = await engine.current('app')
    debug('starting syncer')
    await syncer.update(approot)
    debug('syncer complete')

    let first
    for await (const crisp of syncer.subscribe()) {
      first = crisp
      break
    }
    debug('crisp', first)
    const children = [...first]
    children.sort((a, b) => a.localeCompare(b))
    debug(children)
    expect(children).toMatchSnapshot()
    expect(first.hasChild('about')).toBe(true)
    const child = first.getChild('about')
    expect(child).toBeInstanceOf(Crisp)
    expect(child.root).toBe(first)
    expect(child.state?.formData?.title).toEqual('CRM')
    await engine.stop()
  })
  it.only('loads actions', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
      repo,
    })
    const api = await engine.actions('/')
    const { pulseResolver, covenantResolver } = engine
    const syncer = Syncer.create(pulseResolver, covenantResolver, api)
    const approot = await engine.latest('/')
    await syncer.update(approot)
    let first
    for await (const crisp of syncer.subscribe()) {
      first = crisp
      break
    }
    const app = first.getChild('app')
    const customers = app.getChild('customers')
    Debug.enable('tests iplog')
    expect(customers.isLoadingActions).toBe(false)
    const actions = customers.getActions()
    expect(actions.cd).toBeDefined()
    expect(actions.batch).toBeDefined()
    expect(actions.add.schema.description).toMatch(/^Add an element/)

    expect(engine.wd).toBe('/')
    await actions.cd('app')
    expect(engine.wd).toBe('/app')
  })
})
