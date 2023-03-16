import equals from 'fast-deep-equal'
import { createRamRepo } from '../../w305-libp2p'
import { Interpulse, Crisp, Syncer } from '..'
import { crm } from '../../w301-user-apps'
import { Pulse } from '../../w008-ipld/src'
import { BakeCache } from '../src/BakeCache'
import Debug from 'debug'
import Immutable from 'immutable'
const debug = Debug('tests')

const actions = { dispatch: (...args) => debug('CI dispatch', args) }

const createCiCache = (fullPulse) => {
  const pulse = fullPulse.getPulseLink()
  const cache = BakeCache.createCI()
  cache.initialize(pulse)
  cache.setPulse(pulse, fullPulse)
  const children = Immutable.Map({ child: pulse })
  cache.updateChildren(pulse, children)
  return cache
}

describe('Crisp', () => {
  it('should create a Crisp', async function () {
    const fullPulse = await Pulse.createCI({ state: { test: true } })
    const pulse = fullPulse.getPulseLink()
    const cache = createCiCache(fullPulse)
    const crisp = Crisp.createRoot(pulse, actions, '/', cache)
    expect(crisp).toBeInstanceOf(Crisp)
    expect(crisp.state).toEqual({ test: true })
    expect(crisp.hasChild('not a path')).toBe(false)
  })
  describe('getSelectedChild', () => {
    let crisp, pulse
    beforeEach(async () => {
      const fullPulse = await Pulse.createCI()
      pulse = fullPulse.getPulseLink()
      const cache = createCiCache(fullPulse)
      crisp = Crisp.createRoot(pulse, actions, '/', cache)
    })
    it('getSelectedChild works when root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/' + virtualPath)
      expect(crisp.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works when not root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/child/' + virtualPath)
      const child = crisp.getChild('child')
      expect(child.path).toBe('/child')
      expect(child.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works deeply nested and root', async () => {
      let crisp = Crisp.createRoot(pulse, actions)
      const virtualPath = '0'
      crisp = crisp.setWd('/' + virtualPath + '/other/paths')
      expect(crisp.getSelectedChild()).toBe(virtualPath)
    })
    it('getSelectedChild works deeply nested and not root', async () => {
      const virtualPath = '0'
      crisp = crisp.setWd('/child/' + virtualPath + '/other/paths')
      const child = crisp.getChild('child')
      expect(child.path).toBe('/child')
      expect(child.getSelectedChild()).toBe(virtualPath)
    })
    it('setWd must be absolute', async () => {
      const crisp = Crisp.createRoot(pulse, actions)
      expect(() => crisp.setWd('non absolute')).toThrow('wd must be absolute')
    })
  })
  describe('absolutePath', () => {
    let pulse, cache
    beforeAll(async () => {
      const fullPulse = await Pulse.createCI()
      pulse = fullPulse.getPulseLink()
      cache = createCiCache(fullPulse)
    })
    it('works when chrooted', async () => {
      const chroot = '/app'
      const crisp = Crisp.createRoot(pulse, actions, chroot, cache)
      expect(crisp.absolutePath).toBe(chroot)
      expect(crisp.path).toBe('/')
      expect(crisp.chroot).toBe(chroot)

      const child = crisp.getChild('child')
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
        if (crisp.isLoadingChildren) {
          continue
        }
        debug('crisp', crisp.sortedChildren, crisp.pulse)
        if (crisp.hasChild('app')) {
          const app = crisp.getChild('app')
          if (!app.isLoadingChildren) {
            debug('app', app.sortedChildren, app.pulse)
            if (app.hasChild('0')) {
              const app0 = app.getChild('0')
              if (!app0.isLoading) {
                return await engine.cd('/app/0')
              }
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
    it('fully syncs', async () => {
      const engine = await Interpulse.createCI({
        overloads: { '/crm': crm.covenant },
        repo,
      })
      debug('starting syncer')
      const { pulseResolver, covenantResolver, api } = engine
      const syncer = Syncer.create(pulseResolver, covenantResolver, api)
      const approot = await engine.current('app')
      debug('starting syncer')
      await syncer.update(approot)
      debug('syncer complete')

      let crisp
      for await (const update of syncer.subscribe()) {
        crisp = update
        if (crisp.isDeepLoaded) {
          break
        }
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

      let final
      for await (const crisp of syncer.subscribe()) {
        final = crisp
        if (final.isDeepLoaded) {
          break
        }
      }
      debug('crisp', final)
      const children = [...final]
      children.sort((a, b) => a.localeCompare(b))
      debug(children)
      expect(children).toMatchSnapshot()
      expect(final.hasChild('about')).toBe(true)
      const child = final.getChild('about')
      expect(child).toBeInstanceOf(Crisp)
      expect(child.root).toBe(final)
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
        if (!first.isLoading && first.hasChild('app')) {
          break
        }
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
        if (crisp.isLoadingChildren) {
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
