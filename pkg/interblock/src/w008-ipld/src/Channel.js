import assert from 'assert-fast'
import { Address, Rx, Tx, Request, Interpulse } from '.'
import Debug from 'debug'
import { IpldStruct } from './IpldStruct'
import { deepFreeze } from './utils'
const debug = Debug('interblock:models:channel')

/**
## Channel

`tip` matches up with precedent on the other side.

Tx and Rx are split out so that they can be stored on the block separately.
Tx needs to be separate so that remote fetching does not expose the channelId.
Rx needs to be separate to allow the ingestion of messages to be halted at any point.
Both are separate from Channel so that the potentially large HAMT that stores
all the Channel instances is updated as little as possible, whilst providing rapid
lookup to get channels that are active.

Tx needs to be hashed as it is an independent transmission, but Rx does not
need to be hashed.

The structure implements the design goal of making the Pulse be the context
of the state machine that processes all the actions.

Channel stores rx and tx only after all the activity has been wrung out of them.

```sh
type Channel struct {
    address Address                 # The remote chainId
    tx &Tx
    rx Rx
    aliases [String]                # reverse lookup
}
```
 */

export class Channel extends IpldStruct {
  static cidLinks = ['tx']
  static classMap = { tx: Tx, rx: Rx }
  static create(address = Address.createUnknown()) {
    assert(address instanceof Address)
    const rx = Rx.create()
    const tx = Tx.create()
    return super.clone({ address, rx, tx, aliases: [] })
  }
  static createRoot() {
    const root = Address.createRoot()
    return Channel.create(root)
  }
  static createLoopback() {
    const loopback = Address.createLoopback()
    return Channel.create(loopback)
  }
  resolve(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.isUnknown(), `Can only resolve unknown channels`)
    return this.setMap({ address })
  }
  isUnknown() {
    return this.address.isUnknown()
  }
  isRemote() {
    return this.address.isRemote()
  }
  getAddress() {
    return this.address
  }
  assertLogic() {
    const { rx, tx, address } = this
    if (this.isUnknown()) {
      assert(rx.isEmpty(), 'Replies to Unknown are impossible')
      assert(!rx.tip)
    }
    if (rx.tip) {
      assert(!address.isLoopback())
    }
    if (address.isLoopback()) {
      assert(!tx.precedent)
      const banned = ['@@OPEN_CHILD']
      const systemRequests = tx.system.requests
      assert(systemRequests.every(({ type }) => !banned.includes(type)))
    }
  }
  txGenesis(params = {}) {
    assert(typeof params === 'object')
    const request = Request.create('@@GENESIS', { params })
    return this.txRequest(request)
  }
  txRequest(request) {
    assert(request instanceof Request)
    const tx = this.tx.txRequest(request)
    return this.setMap({ tx })
  }
  rxReducerRequest() {
    const { requestsRemain } = this.rxReducer
    if (this.address.isLoopback()) {
      assert(this.tx.reducer.requestsStart >= requestsRemain)
      return this.tx.reducer.rxRequest(requestsRemain)
    }
  }
  txReducerReply(reply) {
    // TODO determine if system based on what the current request is ?
    const tx = this.tx.txReducerReply(reply)
    const rxReducer = this.rxReducer.incrementRequests()
    return this.setMap({ tx, rxReducer })
  }
  rxReducerReply() {
    const { repliesRemaining } = this.rxReducer
    if (this.tx.isLoopback()) {
      assert(this.tx.reducer.repliesStart >= repliesRemaining)
      return this.tx.reducer.rxReply(repliesRemaining)
    }
  }
  shiftReducerReplies() {
    const tx = this.tx.shiftReducerReplies()
    const rxReducer = this.rxReducer.incrementReplies()
    return this.constructor.clone({ ...this, tx, rxReducer })
  }
  isNext(channel) {
    assert(channel instanceof Channel)
    // TODO verify the logic follows
    return true
  }
  ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    let { rx } = this
    rx = rx.addTip(interpulse)
    return this.setMap({ rx })
  }
}
