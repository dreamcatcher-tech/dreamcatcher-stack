import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import posix from 'path-browserify'
import { shell } from '..'
import { jest } from '@jest/globals'
import { metrologyFactory } from '../../w018-standard-engine'
import Debug from 'debug'
const debug = Debug('interblock:tests:shell')
chai.use(chaiAsPromised)

describe('machine validation', () => {
  describe('state machine', () => {
    test('buffered request is processed', async () => {
      const base = await metrologyFactory('s', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const cd = shell.actions.cd('child1')
      const cdPromise = base.pierce(cd)
      const ls = shell.actions.ls('/')
      const lsPromise = base.pierce(ls)
      const [cdResult, lsResult] = await Promise.all([cdPromise, lsPromise])
      assert.strictEqual(cdResult.absolutePath, '/child1')
      assert.strictEqual(Object.keys(lsResult.children).length, 4)
      await base.settle()
    })
  })
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  describe('cd', () => {
    test('cd to valid nested path', async () => {
      const base = await metrologyFactory('cd', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()

      const cd = shell.actions.cd('child1')
      const result = await base.pierce(cd)
      assert.strictEqual(result.absolutePath, '/child1')
      debug(`result`, result)

      const context = base.getContext()
      debug(`context:`, context)
      assert.strictEqual(base.getContext().wd, '/child1')

      await base.pierce(shell.actions.add('nested1'))
      const cdNested = shell.actions.cd('nested1')
      const nestedResult = await base.pierce(cdNested)
      debug(`nestedResult`, nestedResult)
      assert.strictEqual(base.getContext().wd, '/child1/nested1')

      await base.settle()
    })
    test('cd errors on garbage path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      const cd = shell.actions.cd('garbagePath')
      await assert.isRejected(base.pierce(cd))
      await base.settle()
    })
    test('cd errors on nested garbage path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      await base.spawn('child1')
      const cd = shell.actions.cd('child1/garbagePath')
      await assert.isRejected(base.pierce(cd))
      const cdTrailing = shell.actions.cd('child1/garbagePath/')
      await assert.isRejected(base.pierce(cdTrailing))
      const cdLong = shell.actions.cd('child1/garbagePath/asdf/asdf/')
      await assert.isRejected(base.pierce(cdLong))
      await base.settle()
    })
    test('. is resolved', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()

      const cd = shell.actions.cd()
      const result = await base.pierce(cd)
      debug(`result`, result)

      const context = base.getContext()
      debug(`context:`, context)
      await base.settle()
      assert.strictEqual(context.wd, '/')
    })
    test(`.. is valid`, async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      await base.spawn('child1')
      const cdChild = shell.actions.cd('child1')
      await base.pierce(cdChild)
      assert.strictEqual(base.getContext().wd, '/child1')

      const cdParent = shell.actions.cd('..')
      const parentResult = await base.pierce(cdParent)
      debug(`parentResult`, parentResult)
      assert.strictEqual(base.getContext().wd, '/')
    })
    test(`cd .. at root stays at root`, async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const cd = shell.actions.cd('.')
      await base.pierce(cd)
      assert.strictEqual(base.getContext().wd, '/')
      const cdUp = shell.actions.cd('..')
      await base.pierce(cdUp)
      assert.strictEqual(base.getContext().wd, '/')
    })
    test.todo('cd rejects if non existent path')
    test.todo('absolute path')
    test.todo('parent path')
  })
  describe('ls', () => {
    test('list current directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls()
      const { children } = await base.pierce(ls)
      debug(`ls: `, children)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const { children: repeated } = await base.pierce(ls)
      assert.deepEqual(Object.keys(repeated), ['..', '.', '.@@io'])
    })
    test('list remote directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      await base.spawn('child1')
      const ls = shell.actions.ls('child1')
      const { children } = await base.pierce(ls)
      assert.deepEqual(Object.keys(children), ['..', '.'])
      const lsAbsolute = shell.actions.ls('child1')
      const { children: childrenAbsolute } = await base.pierce(lsAbsolute)
      assert.deepEqual(Object.keys(childrenAbsolute), ['..', '.'])
    })
    test('throws on invalid directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /nonExistentChild'
      )
    })
    test('throws on invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /nonExistentChild'
      )
    })
    test('throws on invalid double nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested1/nested2')
      await assert.isRejected(base.pierce(ls))
    })
    test('throws on shallow invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const ls = shell.actions.ls('validChild/nonExistentChild')
      await assert.isRejected(base.pierce(ls), 'Non existent path: /validChild')
    })
    test('throws on deep invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('c1')
      await base.pierce(shell.actions.add('c1/nested1'))
      base.enableLogging()

      const ls = shell.actions.ls('c1/nested1/invalid')
      await assert.isRejected(
        base.pierce(ls),
        'Non existent path: /c1/nested1/invalid'
      )
    })
    test('root path when cd is child', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child')
      await base.pierce(shell.actions.cd('child'))
      assert.strictEqual(base.getContext().wd, '/child')

      const ls = shell.actions.ls('/child')
      const result = await base.pierce(ls)
      debug(result)
    })
    test.todo('simultaneous requests')
  })
  describe('getState', () => {
    test('basic', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child')
      const state = await base.pierce(shell.actions.cat('child'))
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
      const covenant = {
        installer: {
          children: {
            testChild: {
              covenant: 'testChildCovenant',
            },
          },
        },
        covenants: {
          testChildCovenant: {
            reducer: (state, action) => {
              debug(`testChildCovenant`, action)
              isExecuted = true
              return state
            },
          },
        },
      }
      const overloads = { hyper: shell, dpkgTest: covenant }
      const blockchain = await metrologyFactory('install', overloads)
      blockchain.enableLogging()
      const publish = shell.actions.publish('dpkgTest', covenant.installer)
      const { dpkgPath } = await blockchain.pierce(publish)
      debug(`dpkgPath: `, dpkgPath)
      const install = shell.actions.install(dpkgPath, 'appTest')
      const installResult = await blockchain.pierce(install)
      debug(`installResult`, installResult)
      assert(isExecuted)
    })
  })
})
