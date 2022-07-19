import assert from 'assert-fast'
import {
  RxReply,
  RequestId,
  Network,
  Reply,
  Address,
  Rx,
  Tx,
  Request,
  Interpulse,
} from '.'
import Debug from 'debug'
import { IpldStruct } from './IpldStruct'
import { RxRequest } from './RxRequest'
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
  static cidLinks = ['tx', 'address']
  static classMap = { tx: Tx, rx: Rx }
  static create(channelId, address = Address.createUnknown()) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(address instanceof Address)
    if (address.isRoot()) {
      assert.strictEqual(channelId, Network.FIXED_IDS.PARENT, `root not parent`)
    }

    const rx = Rx.create()
    const tx = Tx.create()
    return super.clone({ address, rx, tx, aliases: [], channelId })
  }
  static createRoot() {
    const root = Address.createRoot()
    return Channel.create(Network.FIXED_IDS.PARENT, root)
  }
  static createIo() {
    const address = Address.createIo()
    return Channel.create(Network.FIXED_IDS.IO, address)
    // TODO stop Io from being aliased
  }
  static createLoopback() {
    const address = Address.createLoopback()
    return Channel.create(Network.FIXED_IDS.LOOPBACK, address)
  }
  // TODO reject any attempts to alias loopback
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
  assertLogic() {
    const { rx, tx, address, aliases, channelId } = this
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
      assert(!aliases.length)
    }
    if (address.isRoot()) {
      assert.strictEqual(channelId, Network.FIXED_IDS.PARENT, 'Root not parent')
    }
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
  txRequest(request) {
    assert(request instanceof Request)
    const tx = this.tx.txRequest(request)
    return this.setMap({ tx })
  }
  txSystemReply(reply) {
    assert(reply instanceof Reply)
    const tx = this.tx.txSystemReply(reply)
    const rx = this.rx.shiftSystemRequest()
    return this.setMap({ tx, rx })
  }
  txReducerReply(reply) {
    assert(!this.address.isUnknown(), `Address is unknown`)
    assert(reply instanceof Reply)
    const tx = this.tx.txReducerReply(reply)
    const rx = this.rx.shiftReducerRequest()
    return this.setMap({ tx, rx })
  }
  shiftSystemReply() {
    const rx = this.rx.shiftSystemReply()
    return this.setMap({ rx })
  }
  shiftReducerReply() {
    const rx = this.rx.shiftReducerReply()
    return this.setMap({ rx })
  }
  settlePromise(rxReply) {
    const tx = this.tx.settlePromise(rxReply)
    return this.setMap({ tx })
  }
  rxSystemRequest() {
    const { channelId } = this
    const stream = 'system'
    return this.rx.system.rxRequest(channelId, stream)
  }
  rxSystemReply() {
    const { channelId } = this
    const stream = 'system'
    return this.rx.system.rxReply(channelId, stream)
  }
  rxReducerRequest() {
    const { channelId } = this
    const stream = 'reducer'
    return this.rx.reducer.rxRequest(channelId, stream)
  }
  rxReducerReply() {
    const { channelId } = this
    const stream = 'reducer'
    return this.rx.reducer.rxReply(channelId, stream)
  }
  rxIsEmpty() {
    return this.rx.isEmpty()
  }
  getNextRequestId(request) {
    assert(request instanceof Request)
    const { channelId } = this
    const stream = request.isSystem() ? 'system' : 'reducer'
    const requestIndex = this.tx[stream].requestsLength
    return RequestId.create(channelId, stream, requestIndex)
  }
}
