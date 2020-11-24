const assert = require('assert')
const debug = require('debug')('interblock:tests:shell')
const { rxReplyModel, actionModel } = require('../../w015-models')
const { shell } = require('..')
const { effect, interchain } = require('../../w002-api')
const covenants = require('../../w212-system-covenants')
const { metrologyFactory } = require('../../w017-standard-engine')

describe('machine validation', () => {
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  test.todo('rejects invalid path directories')
  test.todo('rejects invalid path files')
  describe('cd', () => {
    require('debug').enable('*met:* *shell')
    test('cd opens up path', async () => {
      const base = await metrologyFactory('e', { hyper: shell })
      await base.spawn('child1')
      base.enableLogging()
      const cd = shell.actions.cd('child1')
      const result = await base.pierce(cd)
      debug(`result`, result)

      const context = base.getContext()
      debug(`context:`, context)
      assert.strictEqual(context.wd, '/child1')

      await base.pierce(shell.actions.add('nested1', {}, 'child1'))
      const cdNested = shell.actions.cd('child1/nested1')
      const nestedResult = await base.pierce(cdNested)
      debug(`nestedResult`, nestedResult)
      assert.strictEqual(base.getContext().wd, '/child1/nested1')

      const remoteResult = await base.pierce(
        shell.actions.add('child1/nested2')
      )

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
    test.todo('cd rejects if non existent path')
    test.todo('relative path with multiple .. entries')
    test.todo('absolute path')
  })
})
