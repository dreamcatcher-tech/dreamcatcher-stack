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
  const network = baseDmz.network.merge({ '@@PIERCE_TARGET': pierceChannel })
  return dmzModel.clone({ ...baseDmz, network })
}

export { generatePierceDmz }
