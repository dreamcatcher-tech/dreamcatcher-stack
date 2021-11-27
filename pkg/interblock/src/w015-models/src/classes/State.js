import assert from 'assert-fast'
import { produceWithPatches, freeze } from 'immer'

export class State {
  #base = {}
  #next
  #diffFor = this.#next
  #lastDiff
  #lastMerge
  constructor(base) {
    if (base) {
      assert.strictEqual(typeof base, 'object')
      const deepFreeze = true
      freeze(base, deepFreeze)
      this.#base = base
    }
  }
  merge() {
    this.diff()
    return new State(this.#base)
  }
  update(updatedState) {
    const next = this.#clone()
    next.#next = updatedState
    return next
  }
  #clone() {
    const next = new State()
    next.#base = this.#base
    next.#next = this.#next
    next.#diffFor = this.#diffFor
    next.#lastDiff = this.#lastDiff
    next.#lastMerge = this.#lastMerge
    return next
  }
  size() {
    // estimate the size based on the total bytes of just the patches
    // apply the diff to a blank object to see the result
    // serialize it to get the size
    // given that all objects ultimately get serialized in diff or full,
    // size calculation should be low cost
  }
  diff() {
    if (!this.next) {
      return []
    }
    if (this.#diffFor === this.#next && this.#lastDiff) {
      return this.#lastDiff
    }
    const [nextState, patches] = produceWithPatches(this.#base, (draft) => {
      // TODO verify this will do structural sharing
      // if not, we will need to use the draft and detect differences ourselves
      return this.#next
    })
    this.#lastDiff = patches
    this.#lastMerge = nextState
    this.#diffFor = this.#next
    return patches
  }
}
