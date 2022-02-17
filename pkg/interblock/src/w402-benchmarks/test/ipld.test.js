import { createHAMT } from 'hamt-sharding'
describe.only('ipld', () => {
  describe('HAMT', () => {
    test('speed', async () => {})
  })
  describe('ipldschemas', () => {
    test('basic', () => {})
  })
})

const ipfsIdeal = {
  announceLatest(chainId, hash) {
    // probably don't need height, as can just check to see if it is valid
    // and if its higher than what we have
  },
  subscribeLatest(chainId, callback) {},
  unsubscribeLatest(chainId, callback) {},
  getLatest(chainId) {},
  getPool(chainId) {},
}
