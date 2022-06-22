import { useState } from '../../w002-api'
import { wrapReduce } from '..'
import { Reply, RequestId, AsyncTrail, RxReply } from '../../w008-ipld'
import assert from 'assert-fast'

describe.only('api', () => {
  describe('useState', () => {
    test('basic', async () => {
      const reducer = async () => {
        let [state, setState] = await useState()
        expect(state).toEqual({})
        await setState({ test: true })
        return { plain: true }
      }

      let trail = AsyncTrail.createCI()
      trail = await wrapReduce(trail, reducer)
      let [get] = trail.txs
      assert.strictEqual(get.request.type, '@@GET_STATE')
      let requestId = RequestId.createCI()
      get = get.setId(requestId)
      trail = trail.updateTxs([get])
      const reply = Reply.createResolve()
      let rxReply = RxReply.create(reply, requestId)
      trail = trail.settleTx(rxReply)
      trail = await wrapReduce(trail, reducer)

      assert(trail.isPending())
      let [set] = trail.txs
      assert.strictEqual(set.request.type, '@@SET_STATE')
      requestId = requestId.setMap({ requestIndex: 1 })
      set = set.setId(requestId)
      trail = trail.updateTxs([set])
      rxReply = RxReply.create(reply, requestId)
      trail = trail.settleTx(rxReply)
      trail = await wrapReduce(trail, reducer)

      assert(!trail.isPending())
      assert(!trail.txs.length)
      assert(trail.reply.payload.plain)
    })
  })
})
