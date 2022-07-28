import chai, { assert } from 'chai/index.mjs'
import posix from 'path-browserify'
import { shell } from '..'
import Debug from 'debug'
import { Engine } from '../../w210-engine'
const debug = Debug('interblock:tests:shell')

describe.concurrent('shell', () => {
  describe('execution', () => {
    test('parallel request is processed', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      const cd = shell.api.cd('child1')
      const cdPromise = engine.pierce(cd)
      const ls = shell.api.ls('/')
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
  describe.concurrent('cd', () => {
    test('cd to valid nested path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const addResult = await engine.pierce(shell.api.add('child1'))
      debug('addResult', addResult)

      const cdAction = shell.api.cd('child1')
      const cdResult = await engine.pierce(cdAction)
      assert.strictEqual(cdResult.absolutePath, '/child1')
      debug(`cdResult`, cdResult)

      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/child1')
      const addNestedResult = await engine.pierce(shell.api.add('nested1'))
      debug(`addNestedResult`, addNestedResult)
      const cdNested = shell.api.cd('nested1')

      const nestedResult = await engine.pierce(cdNested)
      debug(`nestedResult`, nestedResult)
      const { wd: wdNested } = engine.latest.getState().toJS()
      assert.strictEqual(wdNested, '/child1/nested1')
      assert.strictEqual(engine.logger.pulseCount, 14)
    })
    test('cd errors on garbage path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = shell.api.cd('garbagePath')
      const msg = 'Segment not present: /garbagePath of: /garbagePath'
      await expect(engine.pierce(cd)).rejects.toThrow(msg)
    })
    test('cd errors on nested garbage path', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      const cd = shell.api.cd('child1/garbagePath')
      const msg =
        'Segment not present: /child1/garbagePath of: /child1/garbagePath'
      await expect(engine.pierce(cd)).rejects.toThrow(msg)
      const cdTrailing = shell.api.cd('child1/garbagePath/')
      await expect(engine.pierce(cdTrailing)).rejects.toThrow('Segment')
      const cdLong = shell.api.cd('child1/garbagePath/asdf/asdf/')
      await expect(engine.pierce(cdLong)).rejects.toThrow('Segment')
      const cdOk = shell.api.cd('child1')
      await engine.pierce(cdOk)
    })
    test('. is resolved', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = shell.api.cd()
      const result = await engine.pierce(cd)
      debug(`result`, result)

      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/')
    })
    test(`.. is valid`, async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      const cdChild = shell.api.cd('child1')
      await engine.pierce(cdChild)
      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/child1')

      const cdParent = shell.api.cd('..')
      const parentResult = await engine.pierce(cdParent)
      debug(`parentResult`, parentResult)
      const { wd: wdParent } = engine.latest.getState().toJS()
      assert.strictEqual(wdParent, '/')
    })
    test(`cd .. at root stays at root`, async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const cd = shell.api.cd('.')
      await engine.pierce(cd)
      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/')
      const cdUp = shell.api.cd('..')
      await engine.pierce(cdUp)
      const { wd: wdCd } = engine.latest.getState().toJS()
      assert.strictEqual(wdCd, '/')
    })
    test.todo('cd rejects if non existent path')
    test.todo('absolute path')
    test.todo('parent path')
  })
  describe.concurrent('ls', () => {
    test('list current directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = shell.api.ls()
      const { children } = await engine.pierce(ls)
      debug(`ls: `, children)
      assert.deepEqual(Object.keys(children), ['..', '.', '.@@io'])
      const { children: repeated } = await engine.pierce(ls)
      debug(`ls:`, repeated)
      assert.deepEqual(Object.keys(repeated), ['..', '.', '.@@io'])
    })
    test('list remote directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      const ls = shell.api.ls('child1')
      const { children } = await engine.pierce(ls)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const lsAbsolute = shell.api.ls('/child1')
      const { children: childrenAbsolute } = await engine.pierce(lsAbsolute)
      assert.deepEqual(Object.keys(childrenAbsolute), ['..', '.'])
    })
    test('throws on invalid directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = shell.api.ls('nonExistentChild')
      const msg = 'Segment not present: /nonExistentChild of: /nonExistentChild'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = shell.api.ls('nonExistentChild/nested')
      const msg =
        'Segment not present: /nonExistentChild of: /nonExistentChild/nested'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on invalid double nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      const ls = shell.api.ls('nonExistentChild/nested1/nested2')
      const msg =
        'Segment not present: /nonExistentChild of: /nonExistentChild/nested1/nested2'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on shallow invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('validChild'))
      const ls = shell.api.ls('validChild/nonExistentChild')
      const msg =
        'Segment not present: /validChild/nonExistentChild of: /validChild/nonExistentChild'
      await expect(engine.pierce(ls)).rejects.toThrow(msg)
    })
    test('throws on deep invalid nested directory', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('c1'))
      await engine.pierce(shell.api.add('c1/nested1'))

      let ls = shell.api.ls('c1/nested1/invalid')
      await expect(engine.pierce(ls)).rejects.toThrow('Segment not present')

      ls = shell.api.ls('c1/nested1/')
      const result = await engine.pierce(ls)
      assert(result)
    })
    test('root path when cd is child', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      await engine.pierce(shell.api.cd('child1'))
      const { wd } = engine.latest.getState().toJS()
      assert.strictEqual(wd, '/child1')

      const ls = shell.api.ls('/child1')
      const result = await engine.pierce(ls)
      assert(result)
    })
  })
  describe('getState', () => {
    test('basic', async () => {
      const engine = await Engine.createCI({ overloads: { root: shell } })
      await engine.pierce(shell.api.add('child1'))
      const state = await engine.pierce(shell.api.cat('child1'))
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
      const publish = shell.api.publish('dpkgTest', covenant)
      const { path } = await engine.pierce(publish)
      debug(`dpkgPath: `, path)
      assert.strictEqual(path, '/dpkgTest')

      const add = shell.api.add('testInstall', { covenant: path })
      const installResult = await engine.pierce(add)
      debug(`installResult`, installResult)
      assert(isExecuted)
      debug(`pulseCount`, engine.logger.pulseCount)
    })
  })
})
