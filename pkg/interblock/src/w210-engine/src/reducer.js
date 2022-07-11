import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  AsyncRequest,
  AsyncTrail,
  Network,
  Pulse,
  RxReply,
} from '../../w008-ipld'
import { IsolateContainer } from './Services'
import { wrapReduce } from '../../w010-hooks'
import { reducer as systemReducer } from '../../w023-system-reducer'

import Debug from 'debug'
const debug = Debug('interblock:engine:reducer')

export const reducer = async (pulse, isolate, latest) => {
  assert(pulse instanceof Pulse)
  assert(pulse.isModified())
  assert(isolate instanceof IsolateContainer)
  let network = pulse.getNetwork()
  let { pending } = pulse.provenance.dmz
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
    pulse = pulse.setNetwork(network).setPending(pending)
    trail = trail.setMap({ pulse, latest })
    trail = await wrapReduce(trail, systemReducer)
    pulse = trail.pulse
    network = pulse.getNetwork()
    trail = trail.delete('pulse').delete('latest')
    pending = pulse.getPending()
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
      trail = await isolate.reduce(trail)
    }
    network = await transmitTrailReply(trail, network)
    const [nextTrail, nextNetwork] = await transmitTrailTxs(trail, network)
    trail = nextTrail
    network = nextNetwork
    pending = pending.updateTrail(trail)
  }
  // reassigns: pending, network, softpulse
  while (network.channels.rxs.length && counter++ < 10) {
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
  pulse = pulse.setNetwork(network).setPending(pending)
  return pulse
}
const transmitTrailTxs = async (trail, network) => {
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
      // resolve the name to a channelId
      if (!(await network.hasChannel(to))) {
        network = await network.addDownlink(to)
      }
      let channel = await network.getChannel(to)
      const requestId = channel.getNextRequestId(request)
      channel = channel.txRequest(request)
      network = await network.updateChannel(channel)
      txs.push(tx.setId(requestId))
    } catch (error) {
      // TODO should that error the whole trail, before anything is started ?
      txs.push(tx.settleError(error))
    }
  }
  trail = trail.updateTxs(txs)
  return [trail, network]
}
const transmitTrailReply = async (trail, network) => {
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
