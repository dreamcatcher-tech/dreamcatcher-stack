import { reducer } from '..'
import {
  AsyncTrail,
  RequestId,
  RxRequest,
  Request,
  Pulse,
  Reply,
  RxReply,
} from '../../w008-ipld'
import { wrapReduce } from '../../w010-hooks'
import Debug from 'debug'
import assert from 'assert-fast'
Debug.enable('*spawn')

describe('spawn', () => {
  test.only('basic', async () => {
    const request = Request.createSpawn()
    const requestId = RequestId.createCI()
    const rxRequest = RxRequest.create(request, requestId)
    let trail = AsyncTrail.create(rxRequest)
    trail = await wrapReduce(trail, reducer)
    trail.result()
    let [get] = trail.txs
    assert.strictEqual(get.request.type, '@@ADD_CHILD')
    get = get.setId(requestId.next())
    trail = trail.updateTxs([get])
    const pulse = await Pulse.createCI()
    let local = AsyncTrail.createWithPulse(get, pulse)
    local = await wrapReduce(local, reducer)
    trail = trail.settleTx(local.rxReply)

    trail = await wrapReduce(trail, reducer)
    assert(trail.isPending())
    let [add] = trail.txs
    assert.strictEqual(add.request.type, '@@GENESIS')
    add = add.setId(requestId)
    const reply = Reply.createResolve()
    trail = trail.updateTxs([add]).settleTx(RxReply.create(reply, requestId))

    trail = await wrapReduce(trail, reducer)
    assert(trail.result())
    expect(trail).toMatchSnapshot()
  })
})
