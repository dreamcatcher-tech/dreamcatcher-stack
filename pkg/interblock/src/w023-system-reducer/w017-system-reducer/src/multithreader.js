/**
 * Handles tracking multiple pending interchain requests.
 * Never blocks.
 * Can answer questions about the state of various requests.
 *
 * Gets supplied with its own storage slice, and the next action to process.
 * Run by the engine raw, without containment.
 * Userland multithreading still uses the system meta slice but runs in
 * containment.
 */

import assert from 'assert-fast'
import { Pending, RxReply, RxRequest } from '../../w008-ipld'

export const threadReduce = async (meta, action, reducer) => {
  assert.strictEqual(typeof meta, 'object') // this is the meta slice
  assert(action instanceof RxRequest || action instanceof RxReply)
  assert.strictEqual(typeof reducer, 'function')

  let toExecute
  if (action instanceof RxRequest) {
    toExecute = Pending.create(action)
  } else {
    const { system = [] } = meta
    assert(system instanceof Array)
    assert(system.every((p) => p instanceof Pending))
    const requestId = action.getRequestId()
    for (const pending of system) {
      let { pendingTxs } = pending
      for (const pendingTx of pendingTxs) {
        if (pendingTx.requestId.equals(requestId)) {
          assert(pendingTx.request)
          assert(!pendingTx.settled)
          pendingTx = pendingTx.setMap({ settled: action })
          if (pending.isSettled()) {
            assert(!toExecute)
            toExecute = pending
          }
          break // but break out of the whole loop
        }
      }
      // TODO throw if reply was not being awaited
    }
  }
  // accumulator must be ready to execute on, in order for wrapper to accept
  const tick = () => reducer(action)
  // ? does wrapReduce need to be pulled from the global hook ?
  // can either run true wrapReduce in user land, or engine runs it ?
  // threader should be like wrapReduce,

  if (toExecute) {
    const reduction = await wrapReduce(tick, toExecute.accumulator)
    // store the result, which may be to clear the pending slice
  }
}
