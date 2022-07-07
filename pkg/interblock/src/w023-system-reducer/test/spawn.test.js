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
import assert from 'assert-fast'
import Debug from 'debug'

const genesis = await Pulse.createCI()
let pulse = await genesis.generateSoftPulse()

describe('spawn', () => {
  test('basic', async () => {
    const request = Request.createSpawn()
    const requestId = RequestId.createCI()
    const rxRequest = RxRequest.create(request, requestId)
    let trail = AsyncTrail.create(rxRequest)
    trail = await wrapReduce(trail, reducer)
    let [get] = trail.txs
    assert.strictEqual(get.request.type, '@@ADD_CHILD')
    get = get.setId(requestId.next())
    trail = trail.updateTxs([get])
    let local = AsyncTrail.createWithPulse(get, pulse)
    local = await wrapReduce(local, reducer)
    const rxReply = RxReply.create(local.reply, get.requestId)
    trail = trail.settleTx(rxReply)

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
  test('genesis error', async () => {
    const request = Request.createSpawn()
    const requestId = RequestId.createCI()
    const rxRequest = RxRequest.create(request, requestId)
    let trail = AsyncTrail.create(rxRequest)
    trail = await wrapReduce(trail, reducer)
    let [get] = trail.txs
    get = get.setId(requestId.next())
    trail = trail.updateTxs([get])
    let local = AsyncTrail.createWithPulse(get, pulse)
    local = await wrapReduce(local, reducer)
    const rxReply = RxReply.create(local.reply, get.requestId)
    trail = trail.settleTx(rxReply)

    trail = await wrapReduce(trail, reducer)
    assert(trail.isPending())
    let [add] = trail.txs
    assert.strictEqual(add.request.type, '@@GENESIS')
    add = add.setId(requestId)
    const reply = Reply.createError(new Error('genesis error'))
    trail = trail.updateTxs([add]).settleTx(RxReply.create(reply, requestId))

    trail = await wrapReduce(trail, reducer)
    expect(() => trail.result()).toThrowError('genesis error')
  })
})
