import { assert } from 'chai/index.mjs'
import { Engine, Endurance } from '..'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
import { interchain } from '../../w002-api'
const debug = Debug('interblock:tests:engine')

describe('engine', () => {
  test('basic', async () => {
    const engine = await Engine.createCI()
    debug(engine.selfAddress)
    expect(engine.selfAddress.toString()).toMatchSnapshot()

    const request = Request.create('PING')
    const response = await engine.pierce(request)
    assert.deepEqual(response, {})

    const pulse = engine.selfLatest
    assert.deepEqual(pulse.getNetwork().channels.txs, [])
    const io = await pulse.getNetwork().getIo()
    const [reply] = io.tx.reducer.replies
    assert.strictEqual(reply.type, '@@RESOLVE')
  })
  test('latests looked up from Pulses', async () => {
    const overloads = {
      root: {
        reducer: async () => {
          await interchain(Request.createPing(), 'child1')
        },
      },
    }
    const endurance = Endurance.create()
    const engine = await Engine.createCI({ endurance, overloads })
    await engine.pierce(Request.createSpawn('child1'))
    endurance._flushLatests()
    await endurance.endure(endurance.selfLatest)
    await engine.pierce(Request.create('TEST'))
  })
  test.todo('two engines have different addresses')
  describe('deleteChain', () => {
    test.todo('removes a chain')
    test.todo('removes the binary assosciated with a chain')
    test.todo('removes binary that has changed twice')
    test.todo('removes multiple blocks of a chain')
    test.todo('chain killing rejects subscriptions')
  })
  describe('funds', () => {
    test.todo('checks funds available')
  })
})
