import { useAsync } from '../../w002-api'
import { wrapReduceEffects } from '../index.js'
import { Reply, RequestId, AsyncTrail, RxReply } from '../../w008-ipld'

describe('useAsync', () => {
  test('basic', async () => {
    const effect = async () => {
      return await new Promise((r) => setTimeout(r, 100, 'result'))
    }
    const reducer = async () => {
      const result = await useAsync(effect)
      expect(result).toEqual('result')
    }
    let trail = AsyncTrail.createCI()
    const whisper = []
    trail = await wrapReduceEffects(trail, reducer, whisper)
    let [io] = trail.txs
    expect(io.request.type).toBe('@@ASYNC')
    expect(io.request.payload).toEqual({})
    expect(whisper.length).toBe(1)
    const fn = whisper[0]
    expect(fn).toEqual(effect)
    const result = await fn()
    expect(result).toEqual('result')

    let requestId = RequestId.createCI()
    io = io.setId(requestId)
    trail = trail.updateTxs([io])

    const reply = Reply.createResolve({ result })
    let rxReply = RxReply.create(reply, requestId)
    trail = trail.settleTx(rxReply)
    trail = await wrapReduceEffects(trail, reducer, whisper)
    expect(trail.isPending()).toBeFalsy()
  })

  it('throws on fn throw', async () => {
    const error = new Error('throws')
    const effect = async () => {
      return await new Promise((_, r) => setTimeout(r, 100, error))
    }
    const reducer = async () => {
      try {
        await useAsync(effect)
      } catch (caught) {
        expect(caught.message).toBe(error.message)
        return { result: 'caught' }
      }
    }
    let trail = AsyncTrail.createCI()
    const whisper = []
    trail = await wrapReduceEffects(trail, reducer, whisper)
    let [io] = trail.txs
    expect(io.request.type).toBe('@@ASYNC')
    expect(io.request.payload).toEqual({})
    const fn = whisper[0]
    expect(fn).toEqual(effect)
    let result
    try {
      await fn()
    } catch (error) {
      result = error
    }
    expect(result).toBeInstanceOf(Error)

    let requestId = RequestId.createCI()
    io = io.setId(requestId)
    trail = trail.updateTxs([io])

    const reply = Reply.createError(result)
    let rxReply = RxReply.create(reply, requestId)
    trail = trail.settleTx(rxReply)
    whisper.length = 0
    trail = await wrapReduceEffects(trail, reducer, whisper)

    expect(trail.isPending()).toBeFalsy()
    expect(trail.getReply().payload).toEqual({ result: 'caught' })
  })
})
