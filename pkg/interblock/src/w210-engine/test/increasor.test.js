import { assert } from 'chai/index.mjs'
import { Engine } from '..'
import Debug from 'debug'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:tests:increasor')

describe('increasor', () => {
  test('double digit blocks', async () => {
    const engine = await Engine.createCI()
    assert.strictEqual(engine.logger.pulseCount, 1)
    for (let i = 0; i < 10; i++) {
      await engine.pierce(Request.create('PING'))
    }
    assert.strictEqual(engine.logger.pulseCount, 11)
  })
  test.todo('nothing to transmit avoids making a block')
  test.todo('config changes cause new block')
  test.todo('rename alias does not cause interblock')
  test.todo('automatic promises')
  test.todo('tick with no response is an instant resolve')
  test.todo('resolving an alias causes lineage fork')
  test.todo('reject if piercings for unpierced reducer')
  test.todo('triangular test for large numbers of pooled lineage')
})
