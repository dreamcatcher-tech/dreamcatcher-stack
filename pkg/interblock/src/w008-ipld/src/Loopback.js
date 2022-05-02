import assert from 'assert-fast'
import { Network, Channel, Address, RxQueue, Request, Reply } from '.'

const addRequest = (rxQueue, request) => {
  assert(rxQueue instanceof RxQueue)
  assert(request instanceof Request)
  const requestsLength = rxQueue.requestsLength + 1
  const requests = [...rxQueue.requests, request]
  return rxQueue.setMap({ requestsLength, requests })
}
const addReply = (rxQueue, reply) => {
  assert(rxQueue instanceof RxQueue)
  assert(reply instanceof Reply)
  const repliesLength = rxQueue.repliesLength + 1
  const replies = [...rxQueue.replies, reply]
  return rxQueue.setMap({ repliesLength, replies })
}

export class Loopback extends Channel {
  static create() {
    const address = Address.createLoopback()
    const loopback = super.create(Network.FIXED_IDS.LOOPBACK, address)
    assert(loopback instanceof Loopback)
    return loopback
  }
  // TODO reject any attempts to alias loopback
  txGenesis() {
    throw new Error('Loopback cannot birth children')
  }
  txRequest(request) {
    let { system, reducer } = this.rx
    let { tx } = this
    if (request.isSystem()) {
      system = addRequest(system, request)
    } else {
      reducer = addRequest(reducer, request)
    }

    return this.setMap({ rx: { system, reducer } })
  }
  txReducerReply(reply) {
    let { reducer } = this.rx
    reducer = addReply(reducer, reply)
    reducer = reducer.shiftRequests()
    return this.setMap({ rx: { reducer } })
  }
  txSystemReply(reply) {
    let { system } = this.rx
    system = addReply(system, reply)
    system = system.shiftRequests()
    return this.setMap({ rx: { system } })
  }
}
