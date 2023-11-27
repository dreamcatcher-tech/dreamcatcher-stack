import { useState } from '../../w002-api'
import { wrapReduce } from '..'
import { Reply, RequestId, AsyncTrail, RxReply } from '../../w008-ipld'
import assert from 'assert-fast'

describe('api', () => {
  describe('useState', () => {
    test.only('basic', async () => {
      const reducer = async () => {
        let [state, setState] = await useState()
        expect(state).toEqual({ init: true })
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
      const reply = Reply.createResolve({ state: { init: true } })
      let rxReply = RxReply.create(reply, requestId)
      trail = trail.settleTx(rxReply)
      trail = await wrapReduce(trail, reducer)
      assert(trail.isPending())

      // the second get that occurs whenever set is called
      let [reGet] = trail.txs
      assert.strictEqual(reGet.request.type, '@@GET_STATE')
      requestId = RequestId.createCI()
      reGet = reGet.setId(requestId)
      trail = trail.updateTxs([reGet])

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
