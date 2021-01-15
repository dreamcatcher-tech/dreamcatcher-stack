const assert = require('assert')
const { deserializeError } = require('serialize-error')
const { isReplyFor, request, promise, resolve, reject } = require('..')
describe('api', () => {
  describe('isReplyFor', () => {
    test('no request check if is reply', () => {
      const mockRequest = request('mock')
      const mockReply = resolve()
      const isReply = isReplyFor(mockReply)
      assert(isReply)
      const isNotReply = isReplyFor(mockReply, mockRequest)
      assert(!isNotReply)

      // TODO make a valid request reply pair
    })
    test('return false if undefined', () => assert(!isReplyFor()))
    test('reply detected correctly', () => {
      const reply = promise()
      assert(isReplyFor(reply))
    })
  })
  describe('request', () => {
    test('action with "to" added', () => {
      const action = { type: 'PLAIN', payload: { test: 'data' } }
      const to = 'farAway'
      const addressed = request(action, to)
      assert.deepStrictEqual(addressed, { ...action, to })
    })
  })
  describe('reject', () => {
    test('plain objects passed thru', async () => {
      const payload = { plain: 'object' }
      const rejection = reject(payload)
      assert.deepStrictEqual(rejection.payload, payload)
    })
    test('errors can be reinflated', async () => {
      const payload = new Error(`test error`)
      const rejection = reject(payload)
      assert.strictEqual(typeof rejection.payload, 'object')
      const inflated = deserializeError(rejection.payload)
      assert.deepStrictEqual(inflated, payload)
    })
    test('string payloads convert to errors', () => {
      const payload = `test error`
      const rejection = reject(payload)
      assert.strictEqual(typeof rejection.payload, 'object')
      const inflated = deserializeError(rejection.payload)
      assert.deepStrictEqual(inflated, new Error(payload))
    })
  })
  describe('model compatibility', () => {
    test.todo('request => txRequestModel')
    test.todo('promise => txReplyModel')
    test.todo('resolve => txReplyModel')
    test.todo('reject => txReplyModel')
  })
})
