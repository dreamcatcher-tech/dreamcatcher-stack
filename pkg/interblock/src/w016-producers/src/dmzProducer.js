import assert from 'assert-fast'
import {
  blockModel,
  channelModel,
  dmzModel,
  publicKeyModel,
  txReplyModel,
  txRequestModel,
} from '../../w015-models'
import { channelProducer } from '..'

const generatePierceDmz = (targetBlock, pierceReplies, pierceRequests) => {
  assert(blockModel.isModel(targetBlock))
  assert(Array.isArray(pierceReplies))
  assert(Array.isArray(pierceRequests))
  assert(pierceReplies.every(txReplyModel.isModel))
  assert(pierceReplies.every(txRequestModel.isModel))
  if (targetBlock.network['.@@io']) {
    assert(targetBlock.network['.@@io'].address.isResolved())
  }

  const pierceDmz = _extractPierceDmz(targetBlock)
  let txChannel = pierceDmz.network['@@PIERCE_TARGET']
  assert(txChannel.address.equals(targetBlock.provenance.getAddress()))
  assert.strictEqual(txChannel.systemRole, 'PIERCE')

  for (const txReply of pierceReplies) {
    assert(txReply.getAddress().equals(txChannel.address))
    txChannel = channelProducer.txReply(txChannel, txReply)
  }
  for (const txRequest of pierceRequests) {
    const request = txRequest.getRequest()
    txChannel = channelProducer.txRequest(txChannel, request)
  }

  const network = pierceDmz.network.merge({ '@@PIERCE_TARGET': txChannel })
  return dmzModel.clone({ ...pierceDmz, network })
}

const _extractPierceDmz = (block) => {
  const algorithm = '@@pierce'
  const key = '@@PIERCE_PUBLIC_KEY'
  const publicKey = publicKeyModel.clone({ key, algorithm })
  const baseDmz = dmzModel.create({ validators: { ['@@PIERCE']: publicKey } })
  const address = block.provenance.getAddress()
  let pierceChannel = channelModel.create(address, 'PIERCE')
  if (block.network['.@@io']) {
    const { tip } = block.network['.@@io']
    if (tip) {
      pierceChannel = channelModel.clone({ ...pierceChannel, precedent: tip })
    }
  }
  const network = baseDmz.network.merge({ '@@PIERCE_TARGET': pierceChannel })
  return dmzModel.clone({ ...baseDmz, network })
}

const accumulate = (dmz, transmissions = []) => {
  assert(dmzModel.isModel(dmz))
  assert(dmz.pending.getIsPending())
  assert(Array.isArray(transmissions))
  // TODO move to ids for aliases, so we can handle renames
  // TODO deduplication with common/assignReplayIdentifiers

  // first, extend if transmissions
  let accumulator = [...dmz.pending.getAccumulator()]
  for (const tx of transmissions) {
    if (txReplyModel.isModel(tx)) {
      const { type, identifier } = tx
      accumulator.push({ type, identifier })
    } else {
      assert(txRequestModel.isModel(tx))
      const { type, to } = tx
      accumulator.push({ type, to })
    }
  }

  // then resolve the accumulator as best we can
  const requestsMap = _mapRequests(accumulator)
  accumulator = accumulator.map((tx) => {
    if (tx.to && !tx.identifier) {
      const channel = dmz.network[tx.to]
      if (channel) {
        const { address } = channel
        if (address.isResolved() || address.isLoopback()) {
          const requests = requestsMap.get(tx.to)
          const chainId = address.getChainId()
          const height = dmz.getCurrentHeight()
          const index = channel.requests.length - requests.length
          assert(index >= 0)
          requests.shift()
          tx = { ...tx }
          tx.identifier = `${chainId}_${height}_${index}`
        }
      }
    }
    return tx
  })
  const pending = { ...dmz.pending, accumulator }
  return dmzModel.clone({ ...dmz, pending })
}

const _mapRequests = (accumulator) => {
  const toMap = new Map()
  for (const tx of accumulator) {
    if (tx.to) {
      const { to } = tx
      if (!toMap.has(to)) {
        toMap.set(to, [])
      }
      const txRequests = toMap.get(to)
      txRequests.push(tx)
    }
  }
  return toMap
}

export { generatePierceDmz, accumulate }
