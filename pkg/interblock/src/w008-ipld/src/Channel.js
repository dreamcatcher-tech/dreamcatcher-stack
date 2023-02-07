import { deserializeError } from 'serialize-error'
import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  PulseLink,
  RxQueue,
  TxQueue,
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
  static classMap = { tx: Tx, rx: Rx, address: Address }
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
    return Channel.create(Network.FIXED_IDS.LOOPBACK, address).addAlias('.')
  }
  addAlias(alias) {
    assert.strictEqual(typeof alias, 'string')
    if (alias.startsWith('./')) {
      alias = alias.substring(2)
    }
    assert(alias)
    assert.strictEqual(alias, posix.normalize(alias), `path not normalized`)
    if (this.aliases.includes(alias)) {
      return this
    }
    const aliases = [...this.aliases]
    // TODO handle relative aliases by resolving ? or leave as specified ?
    debug('adding alias %s to %i in %o', alias, this.channelId, aliases)
    const isRemotePath = alias.includes('/')
    if (isRemotePath) {
      aliases.push(alias)
    } else {
      aliases.unshift(alias)
    }
    return this.setMap({ aliases })
  }
  // TODO reject any attempts to alias loopback
  resolve(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.isUnknown(), `Can only resolve unknown channels`)
    return this.setMap({ address })
  }
  forkDown(address, latest, precedent) {
    // the chain that this channel points to is being forked
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(latest instanceof PulseLink)
    assert(!latest.equals(this.rx.latest))
    assert(precedent instanceof PulseLink)
    assert(!this.isUnknown() || this.isForkPoint(), `Cannot fork unknown`)
    const tx = this.tx.setMap({ precedent })
    const rx = this.rx.setMap({ tip: latest })
    return this.setMap({ address, tx, rx }).addLatest(latest)
  }
  forkUp(address, precedent, tip) {
    // the new fork takes its first breath
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(precedent instanceof PulseLink)
    assert(!precedent.equals(this.tx.precedent))
    assert(tip instanceof PulseLink)
    assert(!tip.equals(this.rx.tip))
    const rx = this.rx.setMap({ tip })
    const tx = this.tx.setMap({ precedent })
    return this.setMap({ address, tx, rx })
  }
  syncForkPoint(childSide) {
    // called in dmzReducer to add a fork with channel counters synced.
    // tip and precedent will be is set upon softpulse.
    assert(childSide instanceof Channel)
    const rx = this.rx.setMap({
      // TODO unsure how blank() interacts works with Queiscence
      reducer: RxQueue.clone(childSide.tx.reducer.blank()),
      system: RxQueue.clone(childSide.tx.system.blank()),
    })
    const tx = this.tx.setMap({
      // TODO unsure how blank() interacts works with Queiscence
      reducer: TxQueue.clone(childSide.rx.reducer).blank(),
      system: TxQueue.clone(childSide.rx.system).blank(),
    })
    return this.setMap({ rx, tx })
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
    if (address.isLoopback()) {
      assert(rx.tip)
      const banned = ['@@OPEN_CHILD']
      const systemRequests = tx.system.requests
      assert(systemRequests.every(({ type }) => !banned.includes(type)))
      assert.strictEqual(aliases.length, 1)
      assert.strictEqual(aliases[0], '.')
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
    assert(this.address.isResolved(), `Address is unresolved`)
    const tx = this.tx.txSystemReply(reply)
    const rx = this.rx.shiftSystemRequest()
    return this.setMap({ tx, rx })
  }
  txReducerReply(reply) {
    assert(reply instanceof Reply)
    assert(this.address.isResolved(), `Address is unresolved`)
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
  invalidate(pathString, errorSerialized) {
    assert.strictEqual(typeof pathString, 'string')
    assert(pathString)
    assert(!this.address.isResolved())
    assert(this.rx.isEmpty())
    assert(this.rx.system.isStart())
    assert(this.rx.reducer.isStart())
    assert.strictEqual(this.tx.system.repliesLength, 0)
    assert.strictEqual(this.tx.reducer.repliesLength, 0)
    assert.strictEqual(this.tx.system.promisedReplies.length, 0)
    assert.strictEqual(this.tx.reducer.promisedReplies.length, 0)
    const address = Address.createInvalid()
    let { tx, rx } = this
    const cause = deserializeError(errorSerialized)
    const message = `Invalid Path: ${pathString} caused by: ${cause.message}`
    const error = new Error(message, { cause })
    const rejection = Reply.createError(error)
    let system = rejectAll(rx.system, tx.system, rejection)
    let reducer = rejectAll(rx.reducer, tx.reducer, rejection)
    rx = rx.setMap({ system, reducer })
    tx = tx.setMap({ system: tx.system.blank(), reducer: tx.reducer.blank() })

    return this.setMap({ address, tx, rx })
  }
  addLatest(latest) {
    assert(latest instanceof PulseLink)
    const rx = this.rx.addLatest(latest)
    return this.setMap({ rx })
  }
  isForkPoint() {
    return !this.address.isResolved() && !!this.rx.latest
  }
}
const rejectAll = (rxQueue, txQueue, error) => {
  assert(rxQueue instanceof RxQueue)
  assert(txQueue instanceof TxQueue)
  const replies = txQueue.requests.map((_) => error)
  const repliesLength = replies.length
  return rxQueue.setMap({ replies, repliesLength })
}
