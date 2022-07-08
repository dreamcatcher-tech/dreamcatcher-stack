import { assert } from 'chai/index.mjs'
import { interchain } from '../../w002-api'
import { Engine } from '..'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:hooker')

describe('hooker', () => {
  test('loopback cleared immediately', async () => {
    const engine = await Engine.createCI()
    engine.overload({
      root: {
        reducer: async (request) => {
          if (request.type === 'TEST') {
            await interchain(Request.createSpawn('loop'))
            const result = await interchain('PING')
            return result
          }
          if (request.type === 'PING') {
            return { pong: true }
          }
        },
      },
    })
    const ping = Request.create({ type: 'TEST' })
    const result = await engine.pierce(ping)
    assert.strictEqual(result.pong, true)
    const pulse = engine.latest
    const loopback = await pulse.getNetwork().getLoopback()
    assert(loopback.rx.isEmpty())
    assert(loopback.tx.isEmpty())
    assert(loopback.rx.isSettled())
    assert(loopback.tx.isSettled())
    expect(loopback).toMatchSnapshot()
  })
  test.todo('throw if pending and tx a request to self')
  // if only request from pending is a request to self, then know it will never resolve
  // basically cannot raise pending, then request something to self
  test.todo('wait for all promises')
  test.todo('awaiting on self alone rejects')
  // set up a reducer that gets tampered with after promise resolves
  test.todo('covenant must make requests in same order')
})
