import chai, { assert } from 'chai/index.mjs'
import posix from 'path-browserify'
import { shell } from '..'
import Debug from 'debug'
import { Engine } from '../../w210-engine'
import { schemaToFunctions } from '../../w002-api'
const debug = Debug('tests')

describe('shell', () => {
  const api = schemaToFunctions(shell.api)
  describe('execution', () => {
    test('parallel request is processed', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const add = api.add('child1')
      debug(add)
      await engine.pierce(add)
      const cd = api.cd('child1')
      const cdPromise = engine.pierce(cd)
      const ls = api.ls('/')
      const lsPromise = engine.pierce(ls)
      const [cdResult, lsResult] = await Promise.all([cdPromise, lsPromise])
      assert.strictEqual(cdResult.absolutePath, '/child1')
      assert.strictEqual(Object.keys(lsResult.children).length, 4)
      debug(`lsResult`, lsResult)
      debug(`pulseCount`, engine.logger.pulseCount)
    })
  })
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  describe('cd', () => {
    test('cd to valid nested path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const addResult = await engine.pierce(api.add('child1'))
      debug('addResult', addResult)

      const cdAction = api.cd('child1')
      const cdResult = await engine.pierce(cdAction)
      assert.strictEqual(cdResult.absolutePath, '/child1')
      debug(`cdResult`, cdResult)

      const { wd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wd, '/child1')
      const addNestedResult = await engine.pierce(api.add('nested1'))
      debug(`addNestedResult`, addNestedResult)
      const cdNested = api.cd('nested1')

      const nestedResult = await engine.pierce(cdNested)
      debug(`nestedResult`, nestedResult)
      const { wd: wdNested } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wdNested, '/child1/nested1')
    })
    test('cd errors on garbage path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = api.cd('garbagePath')
      const msg = 'Segment not present: /garbagePath of: /garbagePath'
      await expect(engine.pierce(cd)).rejects.toThrow(msg)
    })
    test('cd errors on nested garbage path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      const cd = api.cd('child1/garbagePath')
      const msg =
        'Segment not present: /child1/garbagePath of: /child1/garbagePath'
      await expect(engine.pierce(cd)).rejects.toThrow(msg)
      const cdTrailing = api.cd('child1/garbagePath/')
      await expect(engine.pierce(cdTrailing)).rejects.toThrow('Segment')
      const cdLong = api.cd('child1/garbagePath/asdf/asdf/')
      await expect(engine.pierce(cdLong)).rejects.toThrow('Segment')
      const cdOk = api.cd('child1')
      await engine.pierce(cdOk)
    })
    test('. is resolved', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = api.cd()
      debug(cd)
      const result = await engine.pierce(cd)
      debug(`result`, result)

      const { wd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wd, '/')
    })
    test(`.. is valid`, async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      const cdChild = api.cd('child1')
      await engine.pierce(cdChild)
      const { wd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wd, '/child1')

      const cdParent = api.cd('..')
      const parentResult = await engine.pierce(cdParent)
      debug(`parentResult`, parentResult)
      const { wd: wdParent } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wdParent, '/')
    })
    test(`cd .. at root stays at root`, async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = api.cd('.')
      await engine.pierce(cd)
      const { wd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wd, '/')
      const cdUp = api.cd('..')
      await engine.pierce(cdUp)
      const { wd: wdCd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wdCd, '/')
    })
    test.todo('cd rejects if non existent path')
    test.todo('absolute path')
    test.todo('parent path')
  })
  describe('ls', () => {
    test('list current directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = api.ls()
      const results = await engine.pierce(ls)
      const { children } = results
      debug(`ls: `, children)
      assert.deepEqual(Object.keys(children), ['..', '.', '.@@io'])
      const { children: repeated } = await engine.pierce(ls)
      debug(`ls:`, repeated)
      assert.deepEqual(Object.keys(repeated), ['..', '.', '.@@io'])
    })
    test('list remote directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      const ls = api.ls('child1')
      const { children } = await engine.pierce(ls)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const lsAbsolute = api.ls('/child1')
      const { children: childrenAbsolute } = await engine.pierce(lsAbsolute)
      assert.deepEqual(Object.keys(childrenAbsolute), ['..', '.'])
    })
    test('throws on invalid directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = api.ls('nonExistentChild')
      const msg = 'Segment not present: /nonExistentChild of: /nonExistentChild'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = api.ls('nonExistentChild/nested')
      const msg =
        'Segment not present: /nonExistentChild of: /nonExistentChild/nested'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on invalid double nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = api.ls('nonExistentChild/nested1/nested2')
      const msg =
        'Segment not present: /nonExistentChild of: /nonExistentChild/nested1/nested2'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on shallow invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('validChild'))
      const ls = api.ls('validChild/nonExistentChild')
      const msg =
        'Segment not present: /validChild/nonExistentChild of: /validChild/nonExistentChild'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on deep invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('c1'))
      await engine.pierce(api.add('c1/nested1'))

      let ls = api.ls('c1/nested1/invalid')
      await expect(engine.pierce(ls)).rejects.toThrow('Segment not present')

      ls = api.ls('c1/nested1/')
      const result = await engine.pierce(ls)
      assert(result)
    })
    test('root path when cd is child', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      await engine.pierce(api.cd('child1'))
      const { wd } = engine.selfLatest.getState().toJS()
      assert.strictEqual(wd, '/child1')

      const ls = api.ls('/child1')
      const result = await engine.pierce(ls)
      assert(result)
    })
  })
  describe('getState', () => {
    test('basic', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      const state = await engine.pierce(api.cat('child1'))
      debug(state)
    })
  })
  describe('normalize', () => {
    test('normalize tests', () => {
      const { resolve } = posix
      assert.strictEqual(resolve('/something', '/other/path/.'), '/other/path')
      assert.strictEqual(resolve(`/child/..`), `/`)
      assert.strictEqual(resolve(`/child/../random/..`), `/`)
      assert.strictEqual(resolve(`/child/../random/../`), `/`)
      // TODO more tests of how we expect path normalization to work
    })
  })
  describe('add', () => {
    test('add accepts string installer arg', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1', 'collection'))
      const pulse = await engine.latestByPath('/child1')
      const covenant = await engine.latestByPath(pulse.getCovenantPath())
      const state = covenant.getState().toJS()
      assert.strictEqual(state.name, 'collection')
    })
    test('add needed non existent path throws', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      Debug.enable('*openPath iplog *shell *reducer')
      await expect(() =>
        engine.pierce(api.add('child1/nested'))
      ).rejects.toThrow('path must be foreign')
    })
    test.todo('invalid parent path rejects')
    test.todo('grandchild can spawn')
  })
  describe('install', () => {
    test('deep child runs custom covenant', async () => {
      let isExecuted = false
      const dpkgTest = {
        installer: {
          network: {
            testChild: {
              covenant: '/testChildCovenant',
            },
          },
        },
        reducer: (request) => {
          debug('dpkgTest reducer', request.type)
        },
      }
      const testChildCovenant = {
        reducer: (request) => {
          debug(`testChildCovenant`, request)
          isExecuted = true
        },
      }
      const overloads = {
        root: shell,
        '/testChildCovenant': testChildCovenant,
        '/dpkgTest': dpkgTest,
      }
      const engine = await Engine.createCI({ overloads })
      const { reducer, ...covenant } = dpkgTest
      const publish = api.publish('dpkgTest', covenant)
      debug(covenant)
      const { path } = await engine.pierce(publish)
      debug(`dpkgPath: `, path)
      assert.strictEqual(path, '/dpkgTest')

      const add = api.add('testInstall', { covenant: path })
      const installResult = await engine.pierce(add)
      debug(`installResult`, installResult)
      assert(isExecuted)
      debug(`pulseCount`, engine.logger.pulseCount)
    })
  })
  describe('rm', () => {
    test('basic', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(api.add('child1'))
      const rm = api.rm('child1')
      const result = await engine.pierce(rm)
      assert(result)
    })
  })
})
