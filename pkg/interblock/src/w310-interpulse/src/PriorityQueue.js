import assert from 'assert-fast'
import { pushable } from 'it-pushable'

export class PriorityQueue {
  #buffer = new Set()
  #trigger = pushable({ objectMode: true })
  static create() {
    return new PriorityQueue()
  }
  push(id) {
    assert.strictEqual(typeof id, 'string')
    if (!this.#buffer.has(id)) {
      this.#trigger.push({})
    }
    this.#buffer.delete(id)
    this.#buffer.add(id)
  }
  end(error) {
    this.#trigger.end(error)
  }
  async *[Symbol.asyncIterator]() {
    for await (const trigger of this.#trigger) {
      const iterator = this.#buffer[Symbol.iterator]()
      const id = iterator.next().value
      iterator.return()
      this.#buffer.delete(id)
      yield id
    }
  }
}
