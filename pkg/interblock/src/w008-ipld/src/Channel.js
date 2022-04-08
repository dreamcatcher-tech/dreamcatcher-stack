import assert from 'assert-fast'
import { Address, Rx, Tx, Request, Pulse } from '.'
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
    tx Tx
    rx Rx
    aliases [String]    # all aliases except the address string
}
```
 */

export class Channel extends IpldStruct {
  static cidLinks = ['tx']
  static classMap = { tx: Tx, rx: Rx }
  static create(address = Address.createUnknown()) {
    assert(address instanceof Address)
    const rx = Rx.create()
    const tx = Tx.create(address)
    return super.clone({ rx, tx, aliases: [] })
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
    const tx = this.tx.resolve(address)
    return this.constructor.clone({ ...this, tx })
  }
  isUnknown() {
    return this.tx.address.isUnknown()
  }
  isRemote() {
    return this.tx.address.isRemote()
  }
  getAddress() {
    return this.tx.address
  }
  assertLogic() {
    const { tip, rx, tx } = this
    if (this.isUnknown()) {
      assert(rx.isEmpty(), 'Replies to Unknown are impossible')
      assert(!tip)
    }
    if (tip) {
      assert(!tx.isLoopback())
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
    const { requestsTip } = this.rxReducer
    if (this.tx.isLoopback()) {
      assert(this.tx.reducer.requestsStart >= requestsTip)
      return this.tx.reducer.rxRequest(requestsTip)
    }
  }
  txReducerReply(reply) {
    const tx = this.tx.txReducerReply(reply)
    const rxReducer = this.rxReducer.incrementRequests()
    return this.constructor.clone({ ...this, tx, rxReducer })
  }
  rxReducerReply() {
    const { repliesTip } = this.rxReducer
    if (this.tx.isLoopback()) {
      assert(this.tx.reducer.repliesStart >= repliesTip)
      return this.tx.reducer.rxReply(repliesTip)
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
}
