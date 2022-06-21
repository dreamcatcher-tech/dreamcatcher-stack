import { useState } from '../../w002-api'
import { wrapReduce } from '..'
import { Reply, Request, RequestId } from '../../w008-ipld'
import assert from 'assert-fast'

const request = Request.create('TEST')

describe.only('api', () => {
  describe('useState', () => {
    test('basic', async () => {
      const reducer = async () => {
        let [state, setState] = await useState()
        expect(state).toEqual({})
        await setState({ test: true })
        return { plain: true }
      }
      let reduction = await wrapReduce(request, reducer)
      let [get] = reduction.txs
      assert.strictEqual(get.request.type, '@@GET_STATE')
      const reply = Reply.createResolve({})
      let asyncs = [get.settle(reply)]
      reduction = await wrapReduce(request, reducer, asyncs)

      assert(reduction.isPending())
      let [set] = reduction.txs
      assert.strictEqual(set.request.type, '@@SET_STATE')
      asyncs.push(set.settle(Reply.createResolve()))
      reduction = await wrapReduce(request, reducer, asyncs)

      assert(!reduction.isPending())
      assert(!reduction.txs.length)
      assert(reduction.reply.payload.plain)
    })
  })
})
