import { assert } from 'chai/index.mjs'
import { Engine } from '..'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:engine')

describe('engine', () => {
  test('basic', async () => {
    const engine = await Engine.createCI()
    debug(engine.address)
    expect(engine.address.toString()).toMatchSnapshot()

    const request = Request.create('PING')
    const response = await engine.pierce(request)
    assert.deepEqual(response, {})

    const pulse = engine.latest
    assert.deepEqual(pulse.getNetwork().channels.txs, [])
    const io = await pulse.getNetwork().getIo()
    const [reply] = io.tx.reducer.replies
    assert.strictEqual(reply.type, '@@RESOLVE')
  })
})
