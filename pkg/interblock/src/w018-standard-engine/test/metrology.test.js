import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { shell } from '../../w212-system-covenants'
import { metrologyFactory } from '..'
import { rxdbmem } from '../src/services/rxdbMem'
import Debug from 'debug'
const debug = Debug('interblock:tests:metrology')
Debug.enable()
chai.use(chaiAsPromised)

describe('metrology', () => {
  describe('persistence', () => {
    test('recover from previous database', async () => {
      const rxdb = await rxdbmem('recover1')
      const base1 = await metrologyFactory('a', { hyper: shell }, rxdb)
      await base1.spawn('child1')
      const ping = shell.actions.ping('child1', { test: 'ping' })
      const reply1 = await base1.pierce(ping)
      assert.strictEqual(reply1.test, 'ping')
      await base1.settle()

      const docs = await rxdb.blockchains.find().exec()
      debug(docs.map((doc) => doc.key))
      debug(`reopening db`)
      const base2 = await metrologyFactory('a', { hyper: shell }, rxdb)
      const reply2 = await base2.pierce(ping)
      assert.strictEqual(reply2.test, 'ping')
      await base2.shutdown()
    })
    test.todo('different ids result in different databases')
  })
  describe('spawn', () => {
    test.skip('spawn many times', async () => {
      Debug.enable('*tests* *met*')
      const client = await metrologyFactory()
      // client.enableLogging({ headersOnly: true, path: '/', size: true })
      let count = 0
      const awaits = []
      const start = Date.now()
      while (count < 1000) {
        const result = client.spawn()
        awaits.push(result)
        if (count % 10 === 0) {
          debug(await result)
        }
        count++
      }
      const bulkResult = await Promise.all(awaits)
      debug(`time for ${count} children: ${Date.now() - start}`)
      assert(bulkResult.every(({ chainId }) => chainId))
      /**
       * need to see 1000 children spawned in under 5 seconds, with blocksize of 20kB
       *
       * 2020-07-17 1,000 seconds 800 children, 5.33 MB block size
       */
    })
  })
  describe('actions', () => {
    /**
     * Try different action sizes and see which gives the highest tx rate.
     * Try different sizes of the actions.
     * Try different amounts of computation per action.
     * Generate all interblocks first, using pause, before executing
     */
    test.todo('benchmark max tx thruput')
  })
})
