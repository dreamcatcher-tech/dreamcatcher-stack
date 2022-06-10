import assert from 'assert-fast'
import { RxRequest, Reply, State } from '../../w008-ipld'

export class Reduction {
  static create(origin, result, transmissions) {
    assert(origin instanceof RxRequest)
    assert.strictEqual(typeof result, 'object')
    assert(Array.isArray(transmissions))

    transmissions = transmissions.map((tx) => {
      if (tx instanceof Reply) {
        // use the origin requestId to expand the reply
        // make sure there is only one of these
      }
      return tx
    })
    const instance = new Reduction()
    instance.origin = origin
    instance.transmissions = transmissions
    const isPending = typeof result.then === 'function'
    if (!isPending) {
      // TODO make a state object
      instance.state = State.create(result)
    }
    return instance
  }
}
