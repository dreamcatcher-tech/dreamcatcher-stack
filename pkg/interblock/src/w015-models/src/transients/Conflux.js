import assert from 'assert-fast'
import {
  actionModel,
  blockModel,
  continuationModel,
  interblockModel,
} from '../models'
import { rxReplyModel, rxRequestModel } from '.'
import Debug from 'debug'
const debug = Debug('interblock:models:Conflux')
/**
 * ? Produce the Conflux at the same time as ingestInterblocks
 * ? Deduce which interblocks are used from the network object
 *
 * Without any info other than the interblocks, we can determine the longest
 * sequence of valid interblocks.  With the current block we can determine which
 * ones are valid.
 *
 * Want the check logic of including an interblock to be in one place. If had
 * the modified network, could walk backwards ? This inclusion should happen at
 * the same time as filtering. Could call the producer functions within the
 * conflux ? Interblocks are stored in db in height order, so should receive in
 * order.
 *
 * Also in chainId_height order, so that is how they should arrive. Probably
 * want an ordered map. Conflux takes the current network, the proposed
 * interblocks, and can generate the next network object.
 *
 */
// description: `A conflux is a place where many rivers meet.
// Here, the conflux is where all inbound requests and replies from the
// ingested interblocks are merged together, prior to their execution.
// This allows us to drop the interblocks out of a block, but also allows
// predictable selection of the next action to avoid validators influencing
// the order.
// If the conflux does not fully drain in a block cycle, then a single value
// which is the conflux counter is stored, and will be reconstituted next
// block run, allowing for long running processing of multiple actions to
// occur.`,
export class Conflux {
  #requiredBlockHeights = []
  #requiredRequestsMap = new Map()
  #isReplyInflationComplete = false
  #rxReplies = []
  #rxRequests = []
  #chainMap = new Map()

  static schema = { title: 'Conflux' } // TODO remove need for registry
  constructor(interblocks) {
    assert(Array.isArray(interblocks))
    assert(interblocks.every(interblockModel.isModel))
    this.#mapChainIds(interblocks)
    this.#parseChainMap()
    Object.freeze(this)
  }
  #parseChainMap() {
    // TODO generate iteration order of requests based on some seed
    const uniqueBlockHeights = new Set()
    // TODO make pierce channel get processed last - merely for tidyness
    for (const [, chain] of this.#chainMap) {
      for (const interblock of chain) {
        const address = interblock.provenance.getAddress()
        const { height } = interblock.provenance
        const remote = interblock.getRemote()
        let index = 0
        for (const { type, payload } of remote.requests) {
          const rxRequest = rxRequestModel.create(
            type,
            payload,
            address,
            height,
            index
          )
          this.#rxRequests.push(rxRequest)
          index++
        }
        for (const key in remote.replies) {
          const reply = remote.replies[key]
          const [sHeight, sIndex] = key.split('_')
          const height = parseInt(sHeight)
          const index = parseInt(sIndex)
          // iterates over replies in the order we requested them
          if (!this.#requiredRequestsMap.has(height)) {
            this.#requiredRequestsMap.set(height, new Map())
          }
          const requiredRequests = this.#requiredRequestsMap.get(height)
          if (!requiredRequests.has(address)) {
            requiredRequests.set(address, [])
          }
          const indices = requiredRequests.get(address)
          indices.push({ index, reply })
          indices.sort((a, b) => a.index - b.index)
        }
        for (const height of this.#requiredRequestsMap.keys()) {
          uniqueBlockHeights.add(height)
        }
      }
    }
    this.#requiredBlockHeights.push(...uniqueBlockHeights)
    this.#requiredBlockHeights.sort((a, b) => a - b)
  }
  #mapChainIds(interblocks) {
    for (const interblock of interblocks) {
      const chainId = interblock.getChainId()
      const { height } = interblock.provenance
      const address = interblock.provenance.getAddress()
      const remote = interblock.getRemote()
      if (!this.#chainMap.has(chainId)) {
        this.#chainMap.set(chainId, [])
      }
      const string = this.#chainMap.get(chainId)
      const last = string[string.length - 1]
      if (last) {
        // TODO may be duplicated with checks in channelProducer
        assert.strictEqual(last.provenance.height, height + 1)
        assert(remote.precedent.equals(last.provenance.reflectIntegrity()))
        assert(address.equals(last.provenance.getAddress()))
      }
      string.push(interblock)
    }
  }
  get requiredBlockHeights() {
    Object.freeze(this.#requiredBlockHeights)
    return this.#requiredBlockHeights
  }
  inductRequestBlocks(requestBlocks) {
    assert(this.#requiredBlockHeights.length, `No request blocks required`)
    assert(Array.isArray(requestBlocks))
    assert(requestBlocks.length)
    assert(requestBlocks.every(blockModel.isModel))
    assert(requestBlocks.length, this.#requiredRequestsMap.size)
    assert(requestBlocks.length, this.#requiredBlockHeights)

    let arrayIndex = 0
    for (const height of this.#requiredBlockHeights) {
      // get the address that each request was made to
      const block = requestBlocks[arrayIndex++]
      assert.strictEqual(block.provenance.height, height)
      const requires = this.#requiredRequestsMap.get(height)
      for (const [address, indices] of requires) {
        debug(address.getChainId(), indices)
        const alias = block.network.getAlias(address)
        debug(alias)
        const channel = block.network[alias]
        for (const { index, reply } of indices) {
          const request = channel.requests[index]
          assert(request, `no request at index: ${index}`)
          assert(continuationModel.isModel(reply))
          const { type, payload } = reply
          const rxReply = rxReplyModel.create(type, payload, request)
          this.#rxReplies.push(rxReply)
        }
      }
    }
    this.#isReplyInflationComplete = true
  }
  get rxRequests() {
    Object.freeze(this.#rxRequests)
    return this.#rxRequests
  }
  /**
   * @param {*} interblock
   * @returns Boolean true if this interblock is included in the conflux
   */
  includes(interblock) {}

  get rxReplies() {
    if (this.#requiredBlockHeights.length) {
      assert(this.#isReplyInflationComplete, `Replies have not been inflated`)
    }
    Object.freeze(this.#rxReplies)
    return this.#rxReplies
  }
}
