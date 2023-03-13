import assert from 'assert-fast'
import equals from 'fast-deep-equal'
import { encode } from './IpldUtils'
import { IpldInterface } from './IpldInterface'
import { assertNoUndefined } from './utils'
import Debug from 'debug'
import { CID } from 'multiformats/cid'
const debug = Debug('interblock:classes:State')

// TODO ensure no functions attempted to be stored
// check round trip jsonification is the same

export class State extends IpldInterface {
  #state
  #ipldBlock
  static create(state = {}) {
    const instance = new State()
    instance.#state = state
    instance.assertLogic()
    return instance
  }
  async crush() {
    if (!this.isModified()) {
      return this
    }
    const next = this.#clone()
    next.#ipldBlock = await encode(this.#state)
    return next
  }
  #clone() {
    const next = new State()
    next.#state = this.#state
    next.#ipldBlock = this.#ipldBlock
    return next
  }
  isModified() {
    return !this.#ipldBlock || !equals(this.ipldBlock.value, this.#state)
  }
  get ipldBlock() {
    assert(this.#ipldBlock, `Must call crush() first`)
    return this.#ipldBlock
  }
  get crushedSize() {
    return this.ipldBlock.bytes.length
  }
  get cid() {
    return CID.asCID(this.ipldBlock.cid)
  }
  static async uncrush(cid, resolver) {
    assert(CID.asCID(cid))
    assert.strictEqual(typeof resolver, 'function')
    const [block, resolveUncrushed] = await resolver(cid)
    assert(block)
    assert.strictEqual(typeof block.value, 'object')
    if (block.uncrushed) {
      assert(block.uncrushed instanceof State)
      return block.uncrushed
    }
    const instance = new State()
    instance.#state = block.value
    instance.#ipldBlock = block
    instance.assertLogic()
    if (resolveUncrushed) {
      resolveUncrushed(instance)
    }
    return instance
  }
  getDiffBlocks() {
    const diff = new Map()
    // TODO honour if crush had no change
    diff.set(this.cid.toString(), this.ipldBlock)
    return diff
  }
  assertLogic() {
    assert.strictEqual(typeof this.#state, 'object')
    assert(this.#state !== null)
    assertNoUndefined(this.#state)
    // TODO assert no functions either
  }
  setMap(updatedState) {
    assert.strictEqual(typeof updatedState, 'object')
    assertNoUndefined(updatedState)
    if (equals(updatedState, this.#state)) {
      return this
    }
    const next = this.#clone()
    next.#state = updatedState
    return next
  }
  toJS() {
    return this.#state
  }
  dir() {
    console.dir(this.toJS(), { depth: Infinity })
  }
}
