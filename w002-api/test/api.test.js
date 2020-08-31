const assert = require('assert')
const { isReplyFor, request, promise, resolve, reject } = require('..')
describe('api', () => {
  describe('isReplyFor', () => {
    test('no request check if is reply', () => {
      const mockRequest = request()
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
  describe('model compatibility', () => {
    test.todo('request => txRequestModel')
    test.todo('promise => txReplyModel')
    test.todo('resolve => txReplyModel')
    test.todo('reject => txReplyModel')
  })
})
