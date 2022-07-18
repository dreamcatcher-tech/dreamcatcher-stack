import { shell } from '../../w212-system-covenants'
import { Interpulse } from '..'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('interblock:tests:metrology')
Debug.enable()

describe('Interpulse', () => {
  describe('persistence', () => {
    test.todo('recover from previous database')
    test.todo('different ids result in different databases')
  })
  describe('spawn', () => {
    test.skip('spawn many times', async () => {
      // Debug.enable('iplog')
      const engine = await Interpulse.createCI()
      let count = 0
      const awaits = []
      const start = Date.now()
      while (count < 20) {
        const result = engine.add(`child-${count}`)
        awaits.push(result)
        count++
        if (count % 10 === 0) {
          debug(await result)
        }
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
})
