import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  AsyncRequest,
  AsyncTrail,
  Channel,
  Network,
  Pending,
  Pulse,
  Request,
  RxReply,
} from '../../w008-ipld/index.mjs'
import { Isolate } from './Isolate'
import { wrapReduce } from '../../w010-hooks'
import { reducer as systemReducer } from '../../w023-system-reducer'

import Debug from 'debug'
const debug = Debug('interblock:engine:reducer')

export const reducer = async (pool, isolate, latest) => {
  assert(pool instanceof Pulse)
  assert(pool.isModified())
  assert(pool.getNetwork().channels.rxs.length)
  assert(Isolate.isContainer(isolate))
  assert.strictEqual(typeof latest, 'function')
  let network = pool.getNetwork()
  let { pending } = pool.provenance.dmz
  let counter = 0
  const reduceReply = async (rxReply) => {
    assert(rxReply instanceof RxReply)
    if (rxReply.isPromise()) {
      debug(`reduceReply was promise`)
      return
    }
    debug(`reduce reply %s %s`, rxReply.reply.type, rxReply.requestId)
    let trail = pending.findTrail(rxReply)
    assert(trail, `no trail found for: ${rxReply.requestId}`)
    trail = trail.settleTx(rxReply)
    if (!trail.isFulfilled()) {
      debug(`trail not fulfilled`)
      pending = pending.updateTrail(trail)
      return
    }
    await reduceFulfilledTrail(trail)
  }
  const reduceWithPulse = async (trail) => {
    pool = pool.setNetwork(network).setPending(pending)
    trail = trail.setMap({ pulse: pool, latest })
    const timeout = 10e3
    // TODO make pulse reduction be an action so it is not part of callsites
    trail = await wrapReduce(trail, systemReducer, timeout)
    // as a system reduction, we know it does not use side effects
    pool = trail.pulse
    network = pool.getNetwork()
    trail = trail.delete('pulse').delete('latest')
    pending = pool.getPending()
    return trail
  }

  const reduceFulfilledTrail = async (trail) => {
    assert(trail instanceof AsyncTrail)
    assert(trail.isFulfilled())
    assert(!trail.isSettled())
    if (trail.isSystem()) {
      debug('system trail', trail.origin.request.type)
      trail = await reduceWithPulse(trail)
    } else {
      debug('reducer trail', trail.origin.request.type)
      // TODO reinflate anything that had pulses in it, like USE_PULSE
      trail = await isolate.reduce(trail)
    }
    network = await maybeTransmitTrailReply(trail, network)
    const [nextTrail, nextNet] = await transmitTrailTxs(
      trail,
      network,
      latest,
      pool
    )
    trail = nextTrail
    network = nextNet
    pending = pending.updateTrail(trail)

    if (trail.isFulfilled() && !trail.isSettled()) {
      // transmit errors can cause fulfillment, so we must re-execute
      await reduceFulfilledTrail(trail)
    }
  }
  // reassigns: pending, network, softpulse
  while (network.channels.rxs.length && counter++ < 10000) {
    /**
     * get system reply
     * if system reply
     *    shift the reply, in preparation for the next loop
     *    GENERAL_REPLY
     *      find the trail it came from
     *        error if no trail found
     *      if the trail is fulfilled:
     *          GENERAL_FULFILLED
     *            if system request, reduce using the system reducer
     *            if reducer request, reduce using the reducer reducer
     *    then restart the loop
     * else
     * get system request
     * if system request, make a new trail
     *    REPEAT GENERAL_FULFILLED
     *    then restart the loop
     * else
     * get reducer reply
     * if reducer reply
     *    shift the reply, in preparation for the next loop
     *    REPEAT GENERAL_REPLY
     *    then restart the loop
     * else
     * get reducer request
     * if reducer request, make a new trail
     *    REPEATS FOR FULFILLED TRAIL
     *    then restart the loop
     *
     * only update pulse when doing system reductions
     */
    const rxSystemReply = await network.rxSystemReply()
    if (rxSystemReply) {
      debug('system reply', rxSystemReply.reply.type)
      network = await network.shiftSystemReply()
      await reduceReply(rxSystemReply)
      continue
    }

    const rxSystemRequest = await network.rxSystemRequest()
    if (rxSystemRequest) {
      debug('system request', rxSystemRequest.request.type)
      const trail = AsyncTrail.create(rxSystemRequest)
      pending = pending.addTrail(trail)
      await reduceFulfilledTrail(trail)
      continue
    }

    const rxReducerReply = await network.rxReducerReply()
    if (rxReducerReply) {
      debug('reducer reply', rxReducerReply.reply.type)
      network = await network.shiftReducerReply()
      await reduceReply(rxReducerReply)
      continue
    }

    const rxReducerRequest = await network.rxReducerRequest()
    if (rxReducerRequest) {
      debug('reducer request', rxReducerRequest.request.type)
      const trail = AsyncTrail.create(rxReducerRequest)
      pending = pending.addTrail(trail)
      await reduceFulfilledTrail(trail)
      continue
    }
  }
  pool = pool.setNetwork(network).setPending(pending)
  return pool
}
const transmitTrailTxs = async (trail, network, latest, pool) => {
  assert(trail instanceof AsyncTrail)
  assert(network instanceof Network)
  const txs = []
  const parent = await network.getParent()
  const isRoot = parent.address.isRoot()
  for (const tx of trail.txs) {
    assert(tx instanceof AsyncRequest)
    assert(!tx.isSettled())
    assert(!tx.requestId)
    assert(tx.to)
    let { request, to } = tx
    debug('tx request: %s to: %s', request.type, to)
    to = posix.normalize(to)
    if (to.startsWith('./')) {
      to = to.substring(2)
    }
    if (isRoot && to.startsWith('/')) {
      to = to.substring(1)
    }
    if (!to) {
      to = '.'
    }

    try {
      if (!(await network.hasChannel(to))) {
        // TODO latest does not handle relative paths
        // TODO this lookup should be done after pulsing, due to lookup delays
        // https://github.com/dreamcatcher-tech/dreamcatcher-stack/issues/179

        const target = posix.isAbsolute(to)
          ? await latest(to)
          : await latest(to, pool)
        const address = target.getAddress()
        if (address) {
          assert(address.isRemote())
          network = await network.addDownlink(to, address)
        }
      }
      let channel = await network.getChannel(to)
      const requestId = channel.getNextRequestId(request)
      channel = channel.txRequest(request)
      network = await network.updateChannel(channel)
      txs.push(tx.setId(requestId))
    } catch (error) {
      // TODO should that error the whole trail, before anything is started ?
      // console.error(error)
      txs.push(tx.settleError(error))
    }
  }

  trail = trail.updateTxs(txs)
  return [trail, network]
}
const isOpeningSent = (to, loopback, pending) => {
  assert.strictEqual(typeof to, 'string')
  assert(to)
  assert(loopback instanceof Channel)
  assert(loopback.address.isLoopback())
  assert(pending instanceof Pending)

  for (const request of loopback.tx.system.requests) {
    if (request.type === '@@OPEN_PATH') {
      if (request.payload.to === to) {
        return true
      }
    }
  }
  for (const trail of pending.system) {
    const { request } = trail.origin
    if (request.type === '@@OPEN_PATH') {
      if (request.payload.to === to) {
        return true
      }
    }
  }
  return false
}
const maybeTransmitTrailReply = async (trail, network) => {
  assert(trail instanceof AsyncTrail)
  assert(network instanceof Network)
  if (trail.isOriginTrail()) {
    const reply = trail.getReply()
    debug(`transmit system trail reply`, reply.type)
    if (trail.isSystem()) {
      network = await network.txSystemReply(reply)
    } else {
      network = await network.txReducerReply(reply)
    }
  }
  if (!trail.isPending() && trail.isPreviouslyPending()) {
    assert(!trail.isOriginTrail())
    // if we used to be pending, then we need to resolve a promise
    debug(`resolving a previous promise`)
    const rxReply = trail.getSettleReply()
    network = await network.settlePromise(rxReply)
  }
  return network
}
