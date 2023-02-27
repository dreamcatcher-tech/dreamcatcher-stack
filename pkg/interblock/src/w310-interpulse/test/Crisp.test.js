import equals from 'fast-deep-equal'
import { createRamRepo } from '../../w305-libp2p'
import { Interpulse, Crisp, Syncer } from '..'
import { crm } from '../../w301-user-apps'
import { Pulse } from '../../w008-ipld/src'
import Debug from 'debug'
const debug = Debug('tests')

const actions = { dispatch: (...args) => debug('CI dispatch', args) }

describe('Crisp', () => {
  it('should create a Crisp', async function () {
    const pulse = await Pulse.createCI({ state: { test: true } })
    const crisp = Crisp.createRoot(pulse, actions)
    expect(crisp).toBeInstanceOf(Crisp)
    expect(crisp.state).toEqual({ test: true })
    expect(crisp.hasChild('not a path')).toBe(false)
  })
  describe('getSelectedChild', () => {
    let crisp
    beforeEach(async () => {
      const pulse = await Pulse.createCI()
      crisp = Crisp.createRoot(pulse, actions)
    })
    it('getSelectedChild works when root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/' + virtualPath)
      expect(crisp.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works when not root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/child/' + virtualPath)
      let child = Crisp.createChild(undefined, crisp, 'child')
      expect(child.path).toBe('/child')
      expect(child.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works deeply nested and root', async () => {
      const pulse = await Pulse.createCI()
      let crisp = Crisp.createRoot(pulse, actions)
      const virtualPath = '0'
      crisp = crisp.setWd('/' + virtualPath + '/other/paths')
      expect(crisp.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works deeply nested and not root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/child/' + virtualPath + '/other/paths')
      const child = Crisp.createChild(undefined, crisp, 'child')
      expect(child.path).toBe('/child')
      expect(child.getSelectedChild()).toBe(virtualPath)
    })
    it('setWd must be absolute', async () => {
      const pulse = await Pulse.createCI()
      const crisp = Crisp.createRoot(pulse, actions)
      expect(() => crisp.setWd('non absolute')).toThrow('wd must be absolute')
    })
  })
  describe('absolutePath', () => {
    let pulse
    beforeAll(async () => {
      pulse = await Pulse.createCI()
    })
    it('works when chrooted', async () => {
      const chroot = '/app'
      const crisp = Crisp.createRoot(pulse, actions, chroot)
      expect(crisp.absolutePath).toBe(chroot)
      expect(crisp.path).toBe('/')
      expect(crisp.chroot).toBe(chroot)

      const child = Crisp.createChild(undefined, crisp, 'child')
      expect(child.chroot).toBe(chroot)
      expect(child.absolutePath).toBe('/app/child')
      expect(child.path).toBe('/child')
    })
    it('errors on non absolute chroot', async () => {
      const chroot = 'non absolute'
      expect(() => Crisp.createRoot(pulse, actions, chroot)).toThrow('chroot')
    })
  })
  it('can CD into any path it sees', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('app', '/crm/routing')

    const pathIterator = engine.subscribe('/')
    const { pulseResolver, covenantResolver, api } = engine
    const syncer = Syncer.create(pulseResolver, covenantResolver, api)
    const syncerDrain = async () => {
      for await (const pulse of pathIterator) {
        syncer.update(pulse)
      }
    }
    syncerDrain()
    const crispDrain = async () => {
      for await (const crisp of syncer.subscribe()) {
        if (crisp.isLoading) {
          continue
        }
        debug('crisp', crisp.sortedChildren, crisp.pulse)
        if (crisp.hasChild('app')) {
          const app = crisp.getChild('app')
          if (!app.isLoading && app.hasChild('0')) {
            const app0 = app.getChild('0')
            if (!app0.isLoading) {
              return await engine.cd('/app/0')
            }
          }
        }
      }
    }
    const crispDrainPromise = crispDrain()
    const batch = crm.faker.routing.generateBatch(5)
    await engine.execute('app/batch', { batch })
    await crispDrainPromise
    await engine.stop()
  })
  describe('with preload', () => {
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
    it('reconciles diffs', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
        repo,
      })
      const { pulseResolver, covenantResolver, api } = engine
      const syncer = Syncer.create(pulseResolver, covenantResolver, api)
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
      const { pulseResolver, covenantResolver, api } = engine
      const syncer = Syncer.create(pulseResolver, covenantResolver, api)
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
    it('loads actions', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
        repo,
      })
      const { api, pulseResolver, covenantResolver } = engine
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
      expect(customers.path).toBe('/app/customers')
      expect(customers.isLoadingActions).toBe(false)
      const { actions } = customers
      expect(actions.cd).toBeDefined()
      expect(actions.batch).toBeDefined()
      expect(actions.add.schema.description).toMatch(/^Add an element/)

      expect(engine.wd).toBe('/')
      await actions.cd('app')
      expect(engine.wd).toBe('/app')
      await engine.stop()
    })
    it('loads gracefully', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
        repo,
      })
      const { api, pulseResolver, covenantResolver } = engine
      const syncer = Syncer.create(pulseResolver, covenantResolver, api)
      syncer.concurrency = 1
      const approot = await engine.latest('/')
      syncer.update(approot)
      let last
      function deepJs(crisp) {
        if (crisp.isLoading) {
          return { isLoading: true }
        }
        const js = {}
        js['_state'] = 'loaded'
        if (Object.keys(crisp.state).length) {
          js['_state'] = 'loaded: ' + Object.keys(crisp.state).join(', ')
        }
        for (const child of crisp.sortedChildren) {
          js[child] = deepJs(crisp.getChild(child))
        }
        return js
      }
      const crisps = []
      for await (const crisp of syncer.subscribe()) {
        crisps.push(crisp)
        // needs to seek breadth first
        const js = deepJs(crisp)
        if (!equals(last, js)) {
          last = js
          debug('crisp', js)
        } else {
          debug('crisp same')
        }
        if (crisp.isDeepLoaded) {
          break
        }
      }
      debug('crisps', crisps)
      await engine.stop()
    })
    // make a list of a thousand customers and observe the size growing as sync expands
    it.todo('does not flicker between pulses')
    it.todo('tears without flickering between pulses')
  })
})
