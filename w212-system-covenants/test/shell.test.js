const assert = require('assert')
const debug = require('debug')('interblock:tests:shell')
const { resolve } = require('path')
const { rxReplyModel, actionModel } = require('../../w015-models')
const { shell } = require('..')
const { effect, interchain } = require('../../w002-api')
const covenants = require('../../w212-system-covenants')
const { metrologyFactory } = require('../../w017-standard-engine')
require('debug').enable('*met* *shell *dmz* *piercer*')

describe('machine validation', () => {
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  test.todo('rejects invalid path directories')
  test.todo('rejects invalid path files')
  describe('cd', () => {
    test('cd opens up path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
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
      await assert.rejects(() => base.pierce(cd))
      await base.settle()
    })
    test('cd errors on nested garbage path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      await base.spawn('child1')
      const cd = shell.actions.cd('child1/garbagePath')
      await assert.rejects(() => base.pierce(cd))
      const cdTrailing = shell.actions.cd('child1/garbagePath/')
      await assert.rejects(() => base.pierce(cdTrailing))
      const cdLong = shell.actions.cd('child1/garbagePath/asdf/asdf/')
      await assert.rejects(() => base.pierce(cdLong))
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
      assert.deepStrictEqual(Object.keys(children), ['..', '.@@io', '.'])
      const { children: repeated } = await base.pierce(ls)
      assert.deepStrictEqual(Object.keys(repeated), ['..', '.@@io', '.'])
    })
    test('list remote directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      await base.spawn('child1')
      const ls = shell.actions.ls('child1')
      const { children } = await base.pierce(ls)
      assert.deepStrictEqual(Object.keys(children), ['..', '.'])
      const lsAbsolute = shell.actions.ls('child1')
      const { children: childrenAbsolute } = await base.pierce(lsAbsolute)
      assert.deepStrictEqual(Object.keys(childrenAbsolute), ['..', '.'])
    })
    test('throws on invalid directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild')
      await assert.rejects(
        () => base.pierce(ls),
        (error) => {
          assert.strictEqual(error.message, 'Path invalid: nonExistentChild')
          return true
        }
      )
    })
    test('throws on invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested')
      await assert.rejects(
        () => base.pierce(ls),
        (error) => {
          const msg = 'Path invalid: nonExistentChild/nested'
          assert.strictEqual(error.message, msg)
          return true
        }
      )
    })
    test('throws on invalid double nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      base.enableLogging()
      const ls = shell.actions.ls('nonExistentChild/nested1/nested2')
      await assert.rejects(
        () => base.pierce(ls),
        (error) => {
          const msg = 'Path invalid: nonExistentChild/nested1/nested2'
          assert.strictEqual(error.message, msg)
          return true
        }
      )
    })
    test('throws on shallow invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const ls = shell.actions.ls('validChild/nonExistentChild')
      await assert.rejects(
        () => base.pierce(ls),
        (error) => {
          const msg = 'Path invalid: validChild/nonExistentChild'
          assert.strictEqual(error.message, msg)
          return true
        }
      )
    })
    test('throws on deep invalid nested directory', async () => {
      const base = await metrologyFactory('effect', { hyper: shell })
      await base.spawn('c1')
      await base.pierce(shell.actions.add('c1/nested1'))
      base.enableLogging()

      const ls = shell.actions.ls('c1/nested1/invalid')
      await assert.rejects(
        () => base.pierce(ls),
        (error) => {
          const msg = 'Path invalid: c1/nested1/invalid'
          assert.strictEqual(error.message, msg)
          return true
        }
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
  describe('normalize', () => {
    test('normalize tests', () => {
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
})
