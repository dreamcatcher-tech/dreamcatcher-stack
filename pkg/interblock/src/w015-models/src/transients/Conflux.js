import assert from 'assert-fast'
import {
  continuationModel,
  actionModel,
  interblockModel,
  addressModel,
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
  #rxReplies = []
  #rxRequests = []
  #chainMap = new Map()
  static generateRxReplies = (replies, address) => {
    assert.strictEqual(typeof replies, 'object')
    assert(Object.values(replies).every(continuationModel.isModel))
    assert(addressModel.isModel(address))
    const rxReplies = []
    for (const key in replies) {
      const { type, payload } = replies[key]
      if (type === '@@PROMISE') {
        continue
      }
      const [sHeight, sIndex] = key.split('_')
      const height = parseInt(sHeight)
      const index = parseInt(sIndex)
      const rxReply = rxReplyModel.create(type, payload, address, height, index)
      rxReplies.push(rxReply)
    }
    rxReplies.sort((a, b) => {
      // iterate over replies in the order we requested them
      if (a.height !== b.height) {
        return a.height - b.height
      }
      return a.index - b.index
    })
    return rxReplies
  }
  static generateRxRequests = (requests, address, height) => {
    assert(Array.isArray(requests))
    assert(requests.every(actionModel.isModel))
    assert(addressModel.isModel(address))
    assert(Number.isInteger(height))
    assert(height >= 0)
    const rxRequests = []
    let index = 0
    for (const { type, payload } of requests) {
      const rxRequest = rxRequestModel.create(
        type,
        payload,
        address,
        height,
        index
      )
      rxRequests.push(rxRequest)
      index++
    }
    return rxRequests
  }

  static schema = { title: 'Conflux' } // TODO remove need for registry
  constructor(interblocks) {
    assert(Array.isArray(interblocks))
    assert(interblocks.every(interblockModel.isModel))
    this.#mapChainIds(interblocks)
    this.#generateRx()
    Object.freeze(this.#rxRequests)
    Object.freeze(this.#rxReplies)
    Object.freeze(this)
  }
  #generateRx() {
    // TODO generate pseudo random iteration order of requests
    // TODO make pierce channel get processed last - merely for tidyness
    for (const [, thread] of this.#chainMap) {
      for (const interblock of thread) {
        const address = interblock.provenance.getAddress()
        const { height } = interblock.provenance
        const { replies, requests } = interblock.getRemote()
        this.#rxReplies = Conflux.generateRxReplies(replies, address)
        this.#rxRequests = Conflux.generateRxRequests(requests, address, height)
      }
    }
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
      const thread = this.#chainMap.get(chainId)
      const last = thread[thread.length - 1]
      if (last) {
        // TODO may be duplicated with checks in channelProducer
        assert(remote.precedent.equals(last.provenance.reflectIntegrity()))
        assert(address.equals(last.provenance.getAddress()))
      }
      thread.push(interblock)
    }
  }
  get rxRequests() {
    return this.#rxRequests
  }
  /**
   * @param {*} interblock
   * @returns Boolean true if this interblock is included in the conflux
   */
  includes(interblock) {
    throw new Error('not implemented')
  }

  get rxReplies() {
    return this.#rxReplies
  }
}
