import { useState, useAsync } from '../../w002-api'
import { wrapReduce, popAsyncWhisper } from '../index.js'
import { Reply, RequestId, AsyncTrail, RxReply } from '../../w008-ipld'
import assert from 'assert-fast'

describe('useAsync', () => {
  test.only('basic', async () => {
    const effect = async () => {
      return await new Promise((r) => setTimeout(r, 100, 'result'))
    }
    const reducer = async () => {
      const result = await useAsync(effect)
      expect(result).toEqual('result')
    }
    let trail = AsyncTrail.createCI()
    trail = await wrapReduce(trail, reducer)
    let [io] = trail.txs
    expect(io.request.type).toBe('@@ASYNC')
    const fn = popAsyncWhisper(io.request)
    expect(fn).toEqual(effect)
    const result = await fn()
    expect(result).toEqual('result')

    let requestId = RequestId.createCI()
    io = io.setId(requestId)
    trail = trail.updateTxs([io])

    const reply = Reply.createResolve({ result })
    let rxReply = RxReply.create(reply, requestId)
    trail = trail.settleTx(rxReply)
    trail = await wrapReduce(trail, reducer)

    expect(trail.isPending()).toBeFalsy()
    let [set] = trail.txs
  })
  it.todo('throws on fn throw')
})
